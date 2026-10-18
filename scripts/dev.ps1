param (
    [string]$Command = "test"
)

switch ($Command) {
    "test" {
        Write-Host "Executando testes completos (Frontend + Backend)..." -ForegroundColor Cyan
        npm test
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Set-Location src-tauri
        cargo test
        Set-Location ..
    }
    "clippy" {
        Write-Host "Executando verificação de estilo (cargo clippy)..." -ForegroundColor Cyan
        Set-Location src-tauri
        cargo clippy --all-targets -- -D warnings
        Set-Location ..
    }
    "build" {
        Write-Host "Compilando Frontend e Backend em modo Release..." -ForegroundColor Cyan
        npm run build
        Set-Location src-tauri
        cargo build --release
        Set-Location ..
    }
    "measure" {
        Write-Host "Medindo consumo de memória em repouso..." -ForegroundColor Cyan
        powershell -ExecutionPolicy Bypass -File scripts\measure_memory.ps1
    }
    "dev" {
        Write-Host "Limpando processos residuais e liberando atalhos..." -ForegroundColor Cyan
        Stop-Process -Name "notas-fup" -Force -ErrorAction SilentlyContinue
        $portConns = Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue
        if ($portConns) {
            $pids = $portConns | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($p in $pids) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            }
        }
        Write-Host "Iniciando Tauri em modo de desenvolvimento..." -ForegroundColor Cyan
        npm run tauri dev
    }
    default {
        Write-Host "Comando desconhecido: $Command" -ForegroundColor Red
        Write-Host "Opções disponíveis: test, clippy, build, measure, dev" -ForegroundColor Yellow
    }
}
