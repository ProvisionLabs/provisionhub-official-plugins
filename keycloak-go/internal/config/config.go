package config

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// SecretSource resolves auth settings from a single backend.
type SecretSource interface {
	Name() string
	Get(ctx context.Context, key string) (string, bool, error)
}

// Chain resolves values in order; first hit wins.
type Chain struct {
	Sources []SecretSource
}

func (c Chain) Resolve(ctx context.Context, key string) (string, string, error) {
	for _, src := range c.Sources {
		value, ok, err := src.Get(ctx, key)
		if err != nil {
			return "", "", fmt.Errorf("source %s failed for %s: %w", src.Name(), key, err)
		}
		if ok {
			return value, src.Name(), nil
		}
	}
	return "", "", nil
}

type Settings struct {
	ListenAddr         string
	Version            string
	Provider           string
	Issuer             string
	ClientID           string
	ClientSecret       string
	RedirectURL        string
	Scopes             []string
	LogoutRedirectURL  string
	PostLoginRedirect  string
	CookiePrefix       string
	CookieSecure       bool
	CookieSameSite     string
}

func LoadSettings(ctx context.Context, chain Chain) (Settings, error) {
	cfg := Settings{}
	if value, _, err := chain.Resolve(ctx, "AUTH_PLUGIN_LISTEN_ADDR"); err != nil {
		return Settings{}, err
	} else if value != "" {
		cfg.ListenAddr = value
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_PLUGIN_VERSION"); err != nil {
		return Settings{}, err
	} else if value != "" {
		cfg.Version = value
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_PLUGIN_PROVIDER"); err != nil {
		return Settings{}, err
	} else if value != "" {
		cfg.Provider = value
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_ISSUER"); err != nil {
		return Settings{}, err
	} else {
		cfg.Issuer = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_CLIENT_ID"); err != nil {
		return Settings{}, err
	} else {
		cfg.ClientID = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_CLIENT_SECRET"); err != nil {
		return Settings{}, err
	} else {
		cfg.ClientSecret = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_REDIRECT_URL"); err != nil {
		return Settings{}, err
	} else {
		cfg.RedirectURL = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_SCOPES"); err != nil {
		return Settings{}, err
	} else if strings.TrimSpace(value) != "" {
		cfg.Scopes = splitCSV(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_LOGOUT_REDIRECT_URL"); err != nil {
		return Settings{}, err
	} else {
		cfg.LogoutRedirectURL = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_POST_LOGIN_REDIRECT_URL"); err != nil {
		return Settings{}, err
	} else if strings.TrimSpace(value) != "" {
		cfg.PostLoginRedirect = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_COOKIE_PREFIX"); err != nil {
		return Settings{}, err
	} else if strings.TrimSpace(value) != "" {
		cfg.CookiePrefix = strings.TrimSpace(value)
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_COOKIE_SECURE"); err != nil {
		return Settings{}, err
	} else if strings.TrimSpace(value) != "" {
		cfg.CookieSecure = strings.EqualFold(strings.TrimSpace(value), "true")
	}
	if value, _, err := chain.Resolve(ctx, "AUTH_COOKIE_SAMESITE"); err != nil {
		return Settings{}, err
	} else if strings.TrimSpace(value) != "" {
		cfg.CookieSameSite = strings.TrimSpace(value)
	}

	if cfg.ListenAddr == "" {
		cfg.ListenAddr = ":50051"
	}
	if cfg.Version == "" {
		cfg.Version = "dev"
	}
	if cfg.Provider == "" {
		cfg.Provider = "keycloak"
	}
	if len(cfg.Scopes) == 0 {
		cfg.Scopes = []string{"openid", "profile", "email"}
	}
	if cfg.PostLoginRedirect == "" {
		cfg.PostLoginRedirect = "/"
	}
	if cfg.CookiePrefix == "" {
		cfg.CookiePrefix = "ph_auth_"
	}
	if cfg.CookieSameSite == "" {
		cfg.CookieSameSite = "Lax"
	}

	if err := validate(cfg); err != nil {
		return Settings{}, err
	}

	return cfg, nil
}

func validate(cfg Settings) error {
	missing := []string{}
	required := map[string]string{
		"AUTH_ISSUER":              cfg.Issuer,
		"AUTH_CLIENT_ID":           cfg.ClientID,
		"AUTH_CLIENT_SECRET":       cfg.ClientSecret,
		"AUTH_REDIRECT_URL":        cfg.RedirectURL,
		"AUTH_LOGOUT_REDIRECT_URL": cfg.LogoutRedirectURL,
	}

	for key, value := range required {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, key)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required plugin settings: %s", strings.Join(missing, ", "))
	}

	return nil
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		item := strings.TrimSpace(p)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

type EnvSource struct{}

func (EnvSource) Name() string { return "env" }

func (EnvSource) Get(_ context.Context, key string) (string, bool, error) {
	value, ok := os.LookupEnv(key)
	return value, ok, nil
}

type FileSource struct {
	Path string
}

func (FileSource) Name() string { return "file" }

func (f FileSource) Get(_ context.Context, key string) (string, bool, error) {
	if strings.TrimSpace(f.Path) == "" {
		return "", false, nil
	}

	file, err := os.Open(filepath.Clean(f.Path))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", false, nil
		}
		return "", false, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		if strings.TrimSpace(parts[0]) != key {
			continue
		}
		return strings.TrimSpace(parts[1]), true, nil
	}
	if err := scanner.Err(); err != nil {
		return "", false, err
	}
	return "", false, nil
}

type VaultSource struct {
	Resolver func(ctx context.Context, key string) (string, bool, error)
}

func (VaultSource) Name() string { return "vault" }

func (v VaultSource) Get(ctx context.Context, key string) (string, bool, error) {
	if v.Resolver == nil {
		return "", false, nil
	}
	return v.Resolver(ctx, key)
}

type KeychainSource struct {
	Resolver func(ctx context.Context, key string) (string, bool, error)
}

func (KeychainSource) Name() string { return "keychain" }

func (k KeychainSource) Get(ctx context.Context, key string) (string, bool, error) {
	if k.Resolver == nil {
		return "", false, nil
	}
	return k.Resolver(ctx, key)
}
