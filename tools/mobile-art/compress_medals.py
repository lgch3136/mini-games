"""Convert generated transparent PNGs to small runtime WebPs; Pillow required."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
for rank in ('bronze','silver','gold','prism'):
 source=root/'shared/mobile-art'/f'medal-{rank}.png'
 Image.open(source).save(source.with_suffix('.webp'),quality=88,method=6)
for name in ('bomber','miner','breaker'):
 source=root/'shared/mobile-art'/f'{name}-diorama.png'
 if source.exists():Image.open(source).save(source.with_suffix('.webp'),quality=89,method=6)
