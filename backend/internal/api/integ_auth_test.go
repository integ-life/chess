package api

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"chess/backend/internal/store"
)

func TestIntegAuthUsesPKCEAndCreatesLocalSession(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "app.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	localUser, err := st.CreateUser("alice", "local-password")
	if err != nil {
		t.Fatal(err)
	}

	var expectedChallenge string
	identity := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			clientID, secret, ok := r.BasicAuth()
			if !ok || clientID != "chess" || secret != "test-client-secret-that-is-at-least-32-characters" {
				http.Error(w, "invalid client", http.StatusUnauthorized)
				return
			}
			if err := r.ParseForm(); err != nil {
				http.Error(w, "invalid form", http.StatusBadRequest)
				return
			}
			challenge := sha256.Sum256([]byte(r.FormValue("code_verifier")))
			if base64.RawURLEncoding.EncodeToString(challenge[:]) != expectedChallenge ||
				r.FormValue("code") != "valid-code" ||
				r.FormValue("redirect_uri") != "https://chess.integ.life/api/auth/integ/callback" {
				http.Error(w, "invalid grant", http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "central-access-token"})
		case "/userinfo":
			if r.Header.Get("Authorization") != "Bearer central-access-token" {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{
				"sub":   "central-alice",
				"email": "alice@example.com",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(identity.Close)

	t.Setenv("INTEG_AUTH_ISSUER", identity.URL)
	t.Setenv("INTEG_AUTH_CLIENT_ID", "chess")
	t.Setenv("INTEG_AUTH_CLIENT_SECRET", "test-client-secret-that-is-at-least-32-characters")
	t.Setenv("INTEG_AUTH_REDIRECT_URI", "https://chess.integ.life/api/auth/integ/callback")
	t.Setenv("INTEG_AUTH_FRONTEND_REDIRECT_URI", "https://chess.integ.life/")

	server := httptest.NewServer((&Server{Store: st}).Router())
	t.Cleanup(server.Close)
	client := server.Client()
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}

	start, err := client.Get(server.URL + "/api/auth/integ/start")
	if err != nil {
		t.Fatal(err)
	}
	defer start.Body.Close()
	if start.StatusCode != http.StatusFound {
		t.Fatalf("start status = %d", start.StatusCode)
	}
	authorizeURL, err := url.Parse(start.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	expectedChallenge = authorizeURL.Query().Get("code_challenge")
	if authorizeURL.Host != identity.Listener.Addr().String() ||
		authorizeURL.Query().Get("client_id") != "chess" ||
		authorizeURL.Query().Get("code_challenge_method") != "S256" ||
		authorizeURL.Query().Get("theme") != "chess" ||
		expectedChallenge == "" {
		t.Fatalf("unexpected authorize URL: %s", authorizeURL)
	}
	cookies := start.Cookies()
	if len(cookies) != 2 || !cookies[0].Secure || !cookies[1].Secure {
		t.Fatalf("expected two secure transaction cookies, got %#v", cookies)
	}

	callbackURL := server.URL + "/api/auth/integ/callback?code=valid-code&state=" + url.QueryEscape(authorizeURL.Query().Get("state"))
	callbackRequest, _ := http.NewRequest(http.MethodGet, callbackURL, nil)
	for _, cookie := range cookies {
		callbackRequest.AddCookie(cookie)
	}
	callback, err := client.Do(callbackRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer callback.Body.Close()
	if callback.StatusCode != http.StatusFound {
		t.Fatalf("callback status = %d", callback.StatusCode)
	}
	redirect, err := url.Parse(callback.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	values, err := url.ParseQuery(strings.TrimPrefix(redirect.Fragment, "/?"))
	if err != nil || values.Get("token") == "" {
		t.Fatalf("missing local token in redirect: %s", redirect)
	}
	user, err := st.UserBySession(values.Get("token"))
	if err != nil || user == nil {
		t.Fatalf("resolve local session: user=%#v err=%v", user, err)
	}
	if user.ID == localUser.ID || user.Username == localUser.Username {
		t.Fatalf("central account unsafely linked to password-only local account: %#v", user)
	}
	linked, err := st.UserByIntegSubject("central-alice")
	if err != nil || linked == nil || linked.ID != user.ID {
		t.Fatalf("central subject not linked: user=%#v err=%v", linked, err)
	}
}

func TestRedirectIntegResultDoesNotDoubleEncodeError(t *testing.T) {
	const message = "统一登录状态已失效，请重试"
	recorder := httptest.NewRecorder()
	redirectIntegResult(recorder, httptest.NewRequest(http.MethodGet, "/", nil), "https://chess.integ.life/", url.Values{
		"auth_error": {message},
	})

	location := recorder.Header().Get("Location")
	if strings.Contains(location, "%25") {
		t.Fatalf("redirect double encoded error: %s", location)
	}
	target, err := url.Parse(location)
	if err != nil {
		t.Fatal(err)
	}
	values, err := url.ParseQuery(strings.TrimPrefix(target.Fragment, "/?"))
	if err != nil || values.Get("auth_error") != message {
		t.Fatalf("redirect error = %q, err = %v", values.Get("auth_error"), err)
	}
}
