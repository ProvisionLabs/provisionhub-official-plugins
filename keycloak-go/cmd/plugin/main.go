package main

import (
	"context"
	"log"
	"net"

	"github.com/Provision-Labs/provisionhub-official-plugins/keycloak-go/internal/config"
	"github.com/Provision-Labs/provisionhub-official-plugins/keycloak-go/internal/server"
	authv1 "github.com/Provision-Labs/provisionhub-official-plugins/keycloak-go/proto/authv1"
	"google.golang.org/grpc"
)

func main() {
	ctx := context.Background()

	cfg, err := config.LoadSettings(ctx, config.Chain{
		Sources: []config.SecretSource{
			config.EnvSource{},
			config.FileSource{Path: ".env.auth-plugin"},
			config.VaultSource{},
			config.KeychainSource{},
		},
	})
	if err != nil {
		log.Fatalf("failed to load plugin config: %v", err)
	}

	lis, err := net.Listen("tcp", cfg.ListenAddr)
	if err != nil {
		log.Fatalf("listen error: %v", err)
	}

	grpcServer := grpc.NewServer()
	pluginServer, err := server.New(ctx, cfg)
	if err != nil {
		log.Fatalf("failed to initialize plugin server: %v", err)
	}
	authv1.RegisterAuthPluginServer(grpcServer, pluginServer)

	log.Printf("auth plugin (%s) listening on %s", cfg.Provider, cfg.ListenAddr)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("grpc server failed: %v", err)
	}
}
