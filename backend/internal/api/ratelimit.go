package api

import (
	"sync"
	"time"
)

type rateBucket struct {
	start time.Time
	count int
}

type fixedWindowLimiter struct {
	mu          sync.Mutex
	limit       int
	maxKeys     int
	window      time.Duration
	buckets     map[string]rateBucket
	nextCleanup time.Time
}

func newFixedWindowLimiter(limit int, window time.Duration) *fixedWindowLimiter {
	return &fixedWindowLimiter{limit: limit, maxKeys: 10_000, window: window, buckets: map[string]rateBucket{}}
}

func (l *fixedWindowLimiter) allow(key string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.nextCleanup.IsZero() || !now.Before(l.nextCleanup) {
		for key, bucket := range l.buckets {
			if now.Sub(bucket.start) >= l.window {
				delete(l.buckets, key)
			}
		}
		l.nextCleanup = now.Add(l.window)
	}
	bucket, exists := l.buckets[key]
	if !exists && len(l.buckets) >= l.maxKeys {
		return false
	}
	if bucket.start.IsZero() || now.Sub(bucket.start) >= l.window {
		bucket = rateBucket{start: now}
	}
	if bucket.count >= l.limit {
		return false
	}
	bucket.count++
	l.buckets[key] = bucket
	return true
}
