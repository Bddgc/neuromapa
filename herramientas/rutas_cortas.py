import subprocess
import sys
from pathlib import Path

CARPETA = Path(__file__).resolve().parent.parent
TOPE = 68


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    salida = subprocess.run(["git", "-C", str(CARPETA), "ls-files"], capture_output=True, text=True, encoding="utf-8",
                            errors="replace")
    if salida.returncode != 0:
        print("No pude listar los archivos con git: salteo la revisión de rutas.")
        return 0
    largas = [r for r in salida.stdout.splitlines() if len(r) > TOPE]
    if largas:
        print(f"Estas rutas pasan de {TOPE} caracteres; en Windows el clon falla si la carpeta ya es honda:")
        for ruta in largas:
            print(f"  {len(ruta)}  {ruta}")
        return 1
    print(f"Rutas: todas de {TOPE} caracteres o menos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
