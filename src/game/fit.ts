/**
 * The size of a picture with the given proportions (width / height) when it is
 * shown as large as it can be inside a box, without cropping or stretching it.
 * While the proportions are not known yet it simply fills the box.
 */
export function fitInside(
  aspect: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    return { width: boxWidth, height: boxHeight };
  }
  return aspect >= boxWidth / boxHeight
    ? { width: boxWidth, height: boxWidth / aspect }
    : { width: boxHeight * aspect, height: boxHeight };
}
