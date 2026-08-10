package api

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	integStateCookie    = "xiangqi_integ_state"
	integVerifierCookie = "xiangqi_integ_verifier"
)

type integAuthConfig struct {
	issuer       string
	clientID     string
	clientSecret string
	redirectURI  string
	frontendURI  string
}

type integProfile struct {
	Subject string `json:"sub"`
	Email   string `json:"email"`
}

func (s *Server) handleIntegAuthStart(w http.ResponseWriter, r *http.Request) {
	config, err := loadIntegAuthConfig()
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "unified login is not configured")
		return
	}
	state, err := randomHex(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to start unified login")
		return
	}
	verifier, err := randomHex(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to start unified login")
		return
	}
	secure := strings.HasPrefix(config.redirectURI, "https://")
	setIntegCookie(w, integStateCookie, state, secure)
	setIntegCookie(w, integVerifierCookie, verifier, secure)

	challenge := sha256.Sum256([]byte(verifier))
	query := url.Values{
		"response_type":         {"code"},
		"client_id":             {config.clientID},
		"redirect_uri":          {config.redirectURI},
		"state":                 {state},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(challenge[:])},
		"code_challenge_method": {"S256"},
		"theme":                 {"chess"},
	}
	http.Redirect(w, r, config.issuer+"/authorize?"+query.Encode(), http.StatusFound)
}

func (s *Server) handleIntegAuthCallback(w http.ResponseWriter, r *http.Request) {
	config, err := loadIntegAuthConfig()
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "unified login is not configured")
		return
	}
	secure := strings.HasPrefix(config.redirectURI, "https://")
	defer clearIntegCookie(w, integStateCookie, secure)
	defer clearIntegCookie(w, integVerifierCookie, secure)

	stateCookie, stateErr := r.Cookie(integStateCookie)
	verifierCookie, verifierErr := r.Cookie(integVerifierCookie)
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if state == "" || stateErr != nil || verifierErr != nil || verifierCookie.Value == "" ||
		subtle.ConstantTimeCompare([]byte(state), []byte(stateCookie.Value)) != 1 {
		redirectIntegResult(w, r, config.frontendURI, url.Values{"auth_error": {"统一登录状态已失效，请重试"}})
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		redirectIntegResult(w, r, config.frontendURI, url.Values{"auth_error": {"统一登录未返回授权码"}})
		return
	}
	accessToken, err := exchangeIntegCode(config, code, verifierCookie.Value)
	if err != nil {
		redirectIntegResult(w, r, config.frontendURI, url.Values{"auth_error": {"统一登录授权失败，请重试"}})
		return
	}
	profile, err := fetchIntegProfile(config.issuer, accessToken)
	if err != nil {
		redirectIntegResult(w, r, config.frontendURI, url.Values{"auth_error": {"无法读取统一登录账号"}})
		return
	}
	user, err := s.Store.FindOrCreateIntegUser(profile.Subject, profile.Email)
	if err != nil {
		redirectIntegResult(w, r, config.frontendURI, url.Values{"auth_error": {"无法创建象棋登录会话"}})
		return
	}
	token, _, err := s.Store.CreateSession(user.ID)
	if err != nil {
		redirectIntegResult(w, r, config.frontendURI, url.Values{"auth_error": {"无法创建象棋登录会话"}})
		return
	}
	redirectIntegResult(w, r, config.frontendURI, url.Values{"token": {token}})
}

func loadIntegAuthConfig() (integAuthConfig, error) {
	config := integAuthConfig{
		issuer:       strings.TrimRight(strings.TrimSpace(os.Getenv("INTEG_AUTH_ISSUER")), "/"),
		clientID:     strings.TrimSpace(os.Getenv("INTEG_AUTH_CLIENT_ID")),
		clientSecret: strings.TrimSpace(os.Getenv("INTEG_AUTH_CLIENT_SECRET")),
		redirectURI:  strings.TrimSpace(os.Getenv("INTEG_AUTH_REDIRECT_URI")),
		frontendURI:  strings.TrimSpace(os.Getenv("INTEG_AUTH_FRONTEND_REDIRECT_URI")),
	}
	issuer, issuerErr := url.Parse(config.issuer)
	redirect, redirectErr := url.Parse(config.redirectURI)
	frontend, frontendErr := url.Parse(config.frontendURI)
	if config.clientID == "" || len(config.clientSecret) < 32 ||
		issuerErr != nil || redirectErr != nil || frontendErr != nil ||
		!secureOrLoopback(issuer) || !secureOrLoopback(redirect) || !secureOrLoopback(frontend) {
		return integAuthConfig{}, errors.New("invalid unified login configuration")
	}
	return config, nil
}

func secureOrLoopback(value *url.URL) bool {
	if value == nil || value.Host == "" {
		return false
	}
	if value.Scheme == "https" {
		return true
	}
	host := value.Hostname()
	return value.Scheme == "http" && (host == "localhost" || net.ParseIP(host).IsLoopback())
}

func exchangeIntegCode(config integAuthConfig, code, verifier string) (string, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {config.redirectURI},
		"code_verifier": {verifier},
	}
	request, err := http.NewRequest(http.MethodPost, config.issuer+"/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.SetBasicAuth(config.clientID, config.clientSecret)
	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64<<10))
	if err != nil {
		return "", err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("token exchange returned %d", response.StatusCode)
	}
	var token struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &token); err != nil || token.AccessToken == "" {
		return "", errors.New("missing access token")
	}
	return token.AccessToken, nil
}

func fetchIntegProfile(issuer, accessToken string) (*integProfile, error) {
	request, err := http.NewRequest(http.MethodGet, issuer+"/userinfo", nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := (&http.Client{Timeout: 10 * time.Second}).Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64<<10))
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("userinfo returned %d", response.StatusCode)
	}
	var profile integProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, err
	}
	profile.Subject = strings.TrimSpace(profile.Subject)
	profile.Email = strings.ToLower(strings.TrimSpace(profile.Email))
	if profile.Subject == "" || profile.Email == "" || !strings.Contains(profile.Email, "@") {
		return nil, errors.New("invalid userinfo")
	}
	return &profile, nil
}

func redirectIntegResult(w http.ResponseWriter, r *http.Request, frontendURI string, values url.Values) {
	target, err := url.Parse(frontendURI)
	if err != nil {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	target.Fragment = ""
	http.Redirect(w, r, target.String()+"#/?"+values.Encode(), http.StatusFound)
}

func randomHex(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func setIntegCookie(w http.ResponseWriter, name, value string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/api/auth/integ",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearIntegCookie(w http.ResponseWriter, name string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Path:     "/api/auth/integ",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}
