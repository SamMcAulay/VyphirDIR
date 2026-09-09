/*
 * The four organic blob outlines, shared by the decorative <Blob> component
 * and the landing hub's own inline blob SVGs (src/pages/Landing.jsx).
 * Single source of truth -- spec section 2 requires the hub to reuse these
 * exact paths rather than keep a second copy.
 */
export const BLOB_PATHS = {
    1: 'M45,10 C80,0 130,5 160,35 C190,65 195,115 170,150 C145,185 90,195 55,175 C20,155 5,110 15,70 C22,45 25,18 45,10 Z',
    2: 'M60,15 C100,-5 150,15 175,55 C195,90 185,140 150,170 C115,198 55,195 25,160 C0,130 5,80 25,50 C35,35 45,22 60,15 Z',
    3: 'M90,5 C130,0 175,25 185,65 C195,105 175,150 135,175 C95,198 45,190 20,155 C-5,120 5,70 35,40 C55,20 70,8 90,5 Z',
    4: 'M50,25 C85,0 140,0 170,30 C200,60 195,110 165,145 C135,180 75,190 40,165 C5,140 0,90 15,60 C25,40 35,32 50,25 Z',
};
