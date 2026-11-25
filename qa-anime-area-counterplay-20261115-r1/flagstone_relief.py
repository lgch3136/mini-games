"""Bake a seamless limestone course under the canyon's fixed sun, with a key per slab."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def flagstones(output: Path):
    size, samples, modules, repeat = 512, 2, 14, 8
    edge = size * samples
    pitch = edge / modules
    rng = np.random.default_rng(60217)
    occupied = np.zeros((modules, modules), np.bool_)
    # Place blocks on a torus so that large stones can cross both texture edges.
    shapes = [(2, 1), (1, 2), (2, 2), (3, 1), (1, 3), (3, 2), (1, 1)]
    weights = [.32, .24, .13, .13, .06, .05, .07]
    stones = []
    for cell in rng.permutation(modules * modules):
        z, x = divmod(int(cell), modules)
        if occupied[z, x]:
            continue
        order = rng.choice(len(shapes), len(shapes), replace=False, p=weights)
        for shape in order:
            width, depth = shapes[shape]
            origins = [(x-i, z-j) for j in range(depth) for i in range(width)]
            rng.shuffle(origins)
            for left, top in origins:
                rows = np.arange(top, top+depth) % modules
                cols = np.arange(left, left+width) % modules
                footprint = np.ix_(rows, cols)
                if not np.any(occupied[footprint]):
                    occupied[footprint] = True
                    stones.append((left, top, width, depth))
                    break
            else:
                continue
            break
    assert occupied.all()
    joints = rng.uniform(-.105, .105, (modules, modules, 2)) * pitch

    def knot(x, z):
        return np.array([x, z]) * pitch + joints[z % modules, x % modules]

    labels = np.zeros((edge, edge), np.uint16)
    cracks = np.zeros((edge, edge), np.uint8)
    tone = [.5]
    for stone, (x, z, width, depth) in enumerate(stones, 1):
        boundary = ([(x+i, z) for i in range(width)] +
                    [(x+width, z+i) for i in range(depth)] +
                    [(x+width-i, z+depth) for i in range(width)] +
                    [(x, z+depth-i) for i in range(depth)])
        corners = {0, width, width+depth, 2*width+depth}
        ring = [knot(i, j) for i, j in boundary]
        points = []
        for i, vertex in enumerate(ring):
            if i in corners:
                previous, following = ring[i-1], ring[(i+1) % len(ring)]
                cut = rng.uniform(.045, .19)
                points.extend((vertex + cut*(previous-vertex),
                               vertex + cut*rng.uniform(.65, 1.25)*(following-vertex)))
            else:
                points.append(vertex)
        points = np.asarray(points)
        pigment = rng.uniform(-.063, .054)
        tone.append(.735 + pigment)
        fissure = None
        if rng.random() < .18:
            start = points[rng.integers(len(points))]
            inward = (points.mean(axis=0)-start)*rng.uniform(.20, .46)
            across = np.array([-inward[1], inward[0]]) * rng.uniform(.08, .24)
            fissure = np.array([start, start+inward*.34+across, start+inward*.68-across*.4, start+inward])
        for tx in (-edge, 0, edge):
            for tz in (-edge, 0, edge):
                moved = np.rint(points+[tx, tz]).astype(np.int32)
                if (moved.max(0) < 0).any() or (moved.min(0) >= edge).any():
                    continue
                cv2.fillPoly(labels, [moved], stone)
                if fissure is not None:
                    line = np.rint(fissure+[tx, tz]).astype(np.int32)
                    cv2.polylines(cracks, [line], False, 180, samples, cv2.LINE_AA)

    # Distances are evaluated across the wrap. Neighbours retain a shared joint,
    # even where three slabs of different lengths form a T.
    interior = (labels != 0) & (labels == np.roll(labels, 1, 0)) & (labels == np.roll(labels, 1, 1))
    pad = 12 * samples
    padded = np.pad(interior.astype(np.uint8), pad, mode="wrap")
    distance = cv2.distanceTransform(padded, cv2.DIST_L2, 5)[pad:-pad, pad:-pad] / samples

    def smooth(lo, hi, a):
        t = np.clip((a-lo)/(hi-lo), 0, 1)
        return t*t*(3-2*t)

    def patina(period):
        # A repeated border supplies the neighbouring bicubic samples at all four edges.
        grid = rng.uniform(-1, 1, (period, period)).astype(np.float32)
        u = (np.arange(edge, dtype=np.float32)+.5) * (period/edge)
        xmap, zmap = np.meshgrid(u, u)
        return cv2.remap(grid, xmap, zmap, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP)

    broad = patina(9)
    fleck = patina(71)
    cut = cracks.astype(np.float32) / 255
    face = smooth(.52, 2.05, distance)
    bevel = smooth(.45, 3.35+.68*broad, distance)
    heights = .030*bevel + face*(.008*broad+.0017*fleck-.006*cut)
    # Values are metres. Both texture axes span eight world units.
    derivative = edge / (2*repeat)
    nx = (np.roll(heights, 1, 1)-np.roll(heights, -1, 1))*derivative
    nz = (np.roll(heights, 1, 0)-np.roll(heights, -1, 0))*derivative
    inv_length = 1 / np.sqrt(1+nx*nx+nz*nz)
    tones = np.array(tone, dtype=np.float32)[labels]
    grain = .028*broad+.012*fleck
    stone_face = tones + grain - cut*.076
    grout = .205 + .032*broad+.022*fleck
    red = grout + face*(stone_face-grout) - .047*(face-bevel)
    rgb = np.stack((red, .5+.5*nx*inv_length, .5+.5*nz*inv_length), axis=2)
    rgb = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_AREA)
    packed = np.rint(np.clip(rgb, 0, 1)*255)
    # Interpolation still resolves sub-steps. Keep the wide, flat parts inexpensive
    # to transfer and retain an exact neutral direction when the surface is level.
    packed[:, :, 0] = np.rint(packed[:, :, 0]/3)*3
    packed[:, :, 1:] = 128 + np.rint((packed[:, :, 1:]-128)/8)*8
    packed = np.clip(packed, 0, 255)/255
    # The sun keeps the same world direction throughout the match. Resolve its
    # interaction with the bevel here so mip levels average the actual lit face.
    # The large landscape texture still supplies the colour and shade at each
    # world position; skills, visibility, and realtime shadows remain live.
    tone=packed[:, :, 0]
    face=smooth(.31,.65,tone)
    tilt=2*packed[:, :, 1:]-1
    ny=np.sqrt(np.maximum(.04,1-np.sum(tilt*tilt,axis=2)))
    sun=-.38*tilt[:,:,0]+.30*tilt[:,:,1]+.87*(ny-1)
    reference=np.array([160,159,137],np.float32)/255
    bed=reference*np.array([.72,.726,.694])+[.012,.014,.012]
    top=reference*np.array([1.076,1.046,1.024])+(tone-.735)[:,:,None]*[.79,.72,.64]
    lit=bed+face[:,:,None]*(top-bed)+(sun*face)[:,:,None]*[.235,.211,.171]
    multiplier=.75*lit/reference
    assert multiplier.min()>0 and multiplier.max()<1
    packed=np.uint8(np.rint(255*multiplier))
    # One key for each whole slab. At a verge it determines whether this block
    # extends into the grit. The upper alpha range preserves RGB when a browser
    # decodes the source into a temporary premultiplied image.
    keys=np.random.default_rng(74039).integers(192,256,len(stones)+1,dtype=np.uint8)
    keys[0]=224
    retention=cv2.resize(keys[labels],(size,size),interpolation=cv2.INTER_AREA)
    Image.fromarray(np.dstack((packed,retention))).save(output, "WEBP", lossless=True, method=5)
    return len(stones)
