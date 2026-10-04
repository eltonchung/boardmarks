"""Build the original geometric Boardmarks icon using only Python's standard library."""
from pathlib import Path
import struct, zlib

def inside(x,y,polygon):
    result=False
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if (a[1]>y)!=(b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: result=not result
    return result

def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
for size in (16,32,48,128):
    raw=bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            px,py=(x+.5)/size,(y+.5)/size
            color=(23,24,28,255)
            if inside(px,py,[(.29,.19),(.71,.19),(.71,.83),(.5,.7),(.29,.83)]): color=(182,167,252,255)
            raw.extend(color)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
    Path(f'public/icons/icon-{size}.png').write_bytes(png)
