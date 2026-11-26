#!/usr/bin/env bash
# Solo lectura; no instala, descarga, modifica servicios ni transmite registros personales.
set -u
printf '\n=== Rumbo: comprobación local ===\n'
printf 'Arquitectura: '; uname -m
printf 'CPU lógica: '; nproc
printf '\nMemoria:\n'; free -h
printf '\nDisco del directorio personal:\n'; df -h "$HOME"
printf '\nNode: '; if command -v node >/dev/null; then node --version; else printf 'no instalado\n'; fi
printf '\nOllama: '; if command -v ollama >/dev/null; then ollama --version; else printf 'no instalado\n'; fi
printf '\nServicio local: '
if command -v curl >/dev/null && curl --noproxy '*' --max-time 3 --silent --fail http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
 printf 'responde en localhost\n'
 curl --noproxy '*' --max-time 3 --silent --fail http://127.0.0.1:11434/api/version || true; printf '\n'
else printf 'no comprobado / no disponible\n'; fi
printf '\nEscucha del puerto Ollama (debe limitarse a loopback):\n'
if command -v ss >/dev/null; then ss -ltn 'sport = :11434'; fi
printf '\nModelos locales (si Ollama está disponible):\n'
if command -v ollama >/dev/null; then OLLAMA_HOST=127.0.0.1:11434 ollama list || true; fi
printf '\nFin: no se ha ejecutado ningún modelo ni enviado texto personal.\n'
