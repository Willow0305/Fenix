-- DT-057: busca global no painel sem diferenciar acentos ("joao" encontra "João").
-- Extensão padrão do PostgreSQL (contrib), disponível nos provedores gerenciados.
CREATE EXTENSION IF NOT EXISTS unaccent;
