"""Small geometry helpers -- point-in-polygon test for zone rules."""
from __future__ import annotations

from typing import List, Tuple


def point_in_polygon(point: Tuple[float, float], polygon: List[List[float]]) -> bool:
    """Standard ray-casting point-in-polygon test."""
    x, y = point
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) if (yj - yi) != 0 else 1e-9) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside
