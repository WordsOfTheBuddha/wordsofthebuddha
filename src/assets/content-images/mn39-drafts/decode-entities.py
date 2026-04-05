#!/usr/bin/env python3
"""Replace &#xHHHH; and &#DDD; with UTF-8 in draft SVGs (WebKit-safe)."""
import re
import pathlib


def decode(s: str) -> str:
    def hx(m: re.Match) -> str:
        return chr(int(m.group(1), 16))

    def dec(m: re.Match) -> str:
        return chr(int(m.group(1)))

    s = re.sub(r"&#x([0-9A-Fa-f]+);", hx, s, flags=re.I)
    s = re.sub(r"&#([0-9]+);", dec, s)
    return s


def main() -> None:
    here = pathlib.Path(__file__).resolve().parent
    for f in sorted(here.glob("*.svg")):
        t = f.read_text(encoding="utf-8")
        t2 = decode(t)
        if t != t2:
            f.write_text(t2, encoding="utf-8")
            print("decoded", f.name)


if __name__ == "__main__":
    main()
