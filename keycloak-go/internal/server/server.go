package server

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/Provision-Labs/provisionhub-official-plugins/keycloak-go/internal/config"
	authv1 "github.com/Provision-Labs/provisionhub-official-plugins/keycloak-go/proto/authv1"
	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type Server struct {
	authv1.UnimplementedAuthPluginServer
	cfg      config.Settings
	oauthCfg *oauth2.Config
	verifier *oidc.IDTokenVerifier
}

func New(ctx context.Context, cfg config.Settings) (*Server, error) {
	provider, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, fmt.Errorf("oidc provider setup failed: %w", err)
	}

	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Scopes:       cfg.Scopes,
		Endpoint:     provider.Endpoint(),
	}

	return &Server{
		cfg:      cfg,
		oauthCfg: oauthCfg,
		verifier: provider.Verifier(&oidc.Config{ClientID: cfg.ClientID}),
	}, nil
}

func (s *Server) StartLogin(_ context.Context, _ *authv1.StartLoginRequest) (*authv1.StartLoginResponse, error) {
	state, err := generateState()
	if err != nil {
		return nil, err
	}

	return &authv1.StartLoginResponse{
		StatusCode:  int32(http.StatusFound),
		RedirectUrl: s.oauthCfg.AuthCodeURL(state),
		SetCookies: []*authv1.CookieKV{
			s.newCookie(s.cookieName("state"), state, 300),
		},
	}, nil
}

func (s *Server) HandleCallback(ctx context.Context, req *authv1.HandleCallbackRequest) (*authv1.HandleCallbackResponse, error) {
	stateCookie := readCookie(req.GetCookies(), s.cookieName("state"))
	query, err := url.ParseQuery(req.GetHttp().GetQuery())
	if err != nil {
		return nil, err
	}

	if stateCookie == "" || stateCookie != query.Get("state") {
		return &authv1.HandleCallbackResponse{StatusCode: int32(http.StatusBadRequest)}, nil
	}

	token, err := s.oauthCfg.Exchange(ctx, query.Get("code"))
	if err != nil {
		return nil, fmt.Errorf("token exchange failed: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return nil, fmt.Errorf("id_token missing in oauth response")
	}

	identity, err := s.verifyIdentity(ctx, rawIDToken)
	if err != nil {
		return nil, err
	}

	return &authv1.HandleCallbackResponse{
		StatusCode:  int32(http.StatusFound),
		RedirectUrl: s.cfg.PostLoginRedirect,
		Identity:    identity,
		SetCookies: []*authv1.CookieKV{
			s.newCookie(s.cookieName("state"), "", -1),
			s.newCookie(s.cookieName("id_token"), rawIDToken, ttlFromExpiry(token.Expiry)),
			s.newCookie(s.cookieName("access_token"), token.AccessToken, ttlFromExpiry(token.Expiry)),
		},
	}, nil
}

func (s *Server) Logout(_ context.Context, req *authv1.LogoutRequest) (*authv1.LogoutResponse, error) {
	idToken := readCookie(req.GetCookies(), s.cookieName("id_token"))
	logoutURL := fmt.Sprintf(
		"%s/protocol/openid-connect/logout?id_token_hint=%s&post_logout_redirect_uri=%s",
		s.cfg.Issuer,
		url.QueryEscape(idToken),
		url.QueryEscape(s.cfg.LogoutRedirectURL),
	)

	return &authv1.LogoutResponse{
		StatusCode:  int32(http.StatusFound),
		RedirectUrl: logoutURL,
		SetCookies: []*authv1.CookieKV{
			s.newCookie(s.cookieName("id_token"), "", -1),
			s.newCookie(s.cookieName("access_token"), "", -1),
			s.newCookie(s.cookieName("state"), "", -1),
		},
	}, nil
}

func (s *Server) Authenticate(ctx context.Context, req *authv1.AuthenticateRequest) (*authv1.AuthenticateResponse, error) {
	rawIDToken := readCookie(req.GetCookies(), s.cookieName("id_token"))
	if rawIDToken == "" {
		return &authv1.AuthenticateResponse{Authenticated: false, Reason: "missing id_token"}, nil
	}

	identity, err := s.verifyIdentity(ctx, rawIDToken)
	if err != nil {
		return &authv1.AuthenticateResponse{Authenticated: false, Reason: err.Error()}, nil
	}

	return &authv1.AuthenticateResponse{
		Authenticated: true,
		Identity:      identity,
	}, nil
}

func (s *Server) Health(_ context.Context, _ *authv1.HealthRequest) (*authv1.HealthResponse, error) {
	return &authv1.HealthResponse{
		Ready:    true,
		Version:  s.cfg.Version,
		Provider: s.cfg.Provider,
		Message:  "ok",
	}, nil
}

func (s *Server) verifyIdentity(ctx context.Context, rawIDToken string) (*authv1.UserIdentity, error) {
	idToken, err := s.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("id token verify failed: %w", err)
	}

	var claims struct {
		Sub               string `json:"sub"`
		Email             string `json:"email"`
		PreferredUsername string `json:"preferred_username"`
		RealmAccess       struct {
			Roles []string `json:"roles"`
		} `json:"realm_access"`
	}

	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("claims decode failed: %w", err)
	}

	return &authv1.UserIdentity{
		UserId:   claims.Sub,
		Username: claims.PreferredUsername,
		Email:    claims.Email,
		Groups:   claims.RealmAccess.Roles,
	}, nil
}

func (s *Server) newCookie(name, value string, maxAge int32) *authv1.CookieKV {
	return &authv1.CookieKV{
		Name:     name,
		Value:    value,
		MaxAge:   maxAge,
		Path:     "/",
		Secure:   s.cfg.CookieSecure,
		HttpOnly: true,
		SameSite: s.cfg.CookieSameSite,
	}
}

func (s *Server) cookieName(suffix string) string {
	return s.cfg.CookiePrefix + suffix
}

func readCookie(cookies []*authv1.CookieKV, name string) string {
	for _, c := range cookies {
		if c != nil && c.GetName() == name {
			return c.GetValue()
		}
	}
	return ""
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func ttlFromExpiry(expiry time.Time) int32 {
	if expiry.IsZero() {
		return 3600
	}
	seconds := int32(time.Until(expiry).Seconds())
	if seconds <= 0 {
		return 300
	}
	return seconds
}
