#!/usr/bin/env python3
"""
Guarda de drift M04 (D26/Fase 3.2 do plano de integração).

O backend é code-first (springdoc); o front é contract-first. Este script compara os
schemas M04 do contrato gerado pelo backend em execução (`/v3/api-docs`) contra o nosso
`openapi.yaml` (fonte da verdade) e FALHA (exit 1) se algum campo divergir.

Resolve `allOf` dos dois lados (herança de schema), então herança não gera falso-positivo.
Compara o CONJUNTO de nomes de campo por schema — que é o que a serialização JSON usa.

Uso:
  M04_APIDOCS=https://dev-api.entreser.sw3.tec.br/v3/api-docs python3 scripts/m04-check-drift.py
Default do M04_APIDOCS: dev-api.entreser.sw3.tec.br.
"""
import json, os, subprocess, sys

try:
    import yaml
except ImportError:
    sys.exit("Falta pyyaml: pip3 install pyyaml")


def carregar_apidocs(src):
    """Aceita URL (busca via curl — usa os certs do sistema) ou caminho de arquivo local."""
    if src.startswith("http"):
        out = subprocess.run(
            ["curl", "-fsS", "--max-time", "30", src],
            capture_output=True, text=True,
        )
        if out.returncode != 0:
            sys.exit(f"Falha ao baixar {src}: {out.stderr.strip()}")
        return json.loads(out.stdout)
    with open(src) as f:
        return json.load(f)

HERE = os.path.dirname(os.path.abspath(__file__))
CONTRACT = os.path.join(HERE, "..", "src", "features", "m04", "contract", "openapi.yaml")
APIDOCS = os.environ.get("M04_APIDOCS", "https://dev-api.entreser.sw3.tec.br/v3/api-docs")

# contrato -> schema DTO do backend. Só os schemas do M04.
PAIRS = [
    ("TipoSessaoInfo", "TipoSessaoInfoDTO"), ("Slot", "SlotDTO"),
    ("SlotsResponse", "SlotsResponseDTO"), ("ProfissionalResumo", "ProfissionalResumoDTO"),
    ("ProfissionalDetalhe", "ProfissionalDetalheDTO"), ("ValorSessao", "ValorSessaoDTO"),
    ("Sessao", "SessaoDTO"), ("SessaoResumo", "SessaoResumoDTO"),
    ("SessaoGrupoPublica", "SessaoGrupoPublicaDTO"), ("CancelamentoResponse", "CancelamentoResponseDTO"),
    ("Participante", "ParticipanteDTO"), ("ConviteResumo", "ConviteResumoDTO"),
    ("ConvitePublico", "ConvitePublicoDTO"), ("PaginaAgenda", "PaginaAgendaDTO"),
    ("DisponibilidadeSemanal", "DisponibilidadeSemanalDTO"),
    ("FaixaDisponibilidade", "FaixaDisponibilidadeDTO"), ("BloqueioAgenda", "BloqueioAgendaDTO"),
    ("UsuariaResumo", "UsuariaResumoDTO"),
]


def fields(name, schemas, seen=None):
    """Conjunto de nomes de campo de um schema, resolvendo allOf/$ref recursivamente."""
    seen = seen or set()
    if name in seen:
        return set()
    seen.add(name)
    s = schemas.get(name)
    if not s:
        return set()
    keys = set(s.get("properties", {}).keys())
    for part in s.get("allOf", []):
        if "$ref" in part:
            keys |= fields(part["$ref"].split("/")[-1], schemas, seen)
        keys |= set(part.get("properties", {}).keys())
    return keys


def main():
    ours = yaml.safe_load(open(CONTRACT))["components"]["schemas"]
    back = carregar_apidocs(APIDOCS)["components"]["schemas"]

    drift = 0
    for c, b in PAIRS:
        if c not in ours:
            print(f"⚠️  contrato não tem '{c}' (ajuste o mapeamento do script)"); drift += 1; continue
        if b not in back:
            print(f"⚠️  backend não expõe '{b}' — rota M04 não deployada?"); drift += 1; continue
        ck, bk = fields(c, ours), fields(b, back)
        falta, extra = ck - bk, bk - ck
        if falta or extra:
            drift += 1
            msg = []
            if falta:
                msg.append(f"FALTA no backend: {sorted(falta)}")
            if extra:
                msg.append(f"extra no backend: {sorted(extra)}")
            print(f"⚠️  {c} → {b}: " + " | ".join(msg))
        else:
            print(f"✅ {c} → {b} ({len(ck)} campos)")

    print("-" * 60)
    if drift:
        print(f"DRIFT detectado em {drift} schema(s). Contrato e backend divergiram.")
        sys.exit(1)
    print(f"Sem drift: {len(PAIRS)} schemas M04 batem com o contrato.")


if __name__ == "__main__":
    main()
