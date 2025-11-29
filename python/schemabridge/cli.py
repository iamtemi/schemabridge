"""CLI wrapper for SchemaBridge Node.js implementation."""

import sys
import subprocess
import shutil
from pathlib import Path
from typing import NoReturn, Optional


def find_node_executable() -> Optional[str]:
    """Find the Node.js executable in the system PATH."""
    return shutil.which("node")


def main() -> NoReturn:
    """
    Main entry point for the SchemaBridge Python CLI.

    This wrapper invokes the Node.js CLI implementation, passing through all arguments.
    """
    node_path = find_node_executable()

    if not node_path:
        print(
            "Error: Node.js not found. SchemaBridge requires Node.js >= 18.0.0.",
            file=sys.stderr,
        )
        print("\nPlease install Node.js from https://nodejs.org/", file=sys.stderr)
        sys.exit(1)

    # Get the path to the bundled Node CLI
    # This will be populated during package build
    package_dir = Path(__file__).parent
    cli_script = package_dir / "bin" / "schemabridge.js"

    if not cli_script.exists():
        print(
            f"Error: SchemaBridge CLI script not found at {cli_script}",
            file=sys.stderr,
        )
        print(
            "The package may not be installed correctly. "
            "Try reinstalling: pip install --force-reinstall schemabridge",
            file=sys.stderr,
        )
        sys.exit(1)

    # Execute the Node.js CLI with all arguments
    try:
        result = subprocess.run(
            [node_path, str(cli_script), *sys.argv[1:]],
            check=False,
        )
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        sys.exit(130)
    except Exception as e:
        print(f"Error executing SchemaBridge: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
