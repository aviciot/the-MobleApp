import React, { useMemo, useEffect } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { OrbMode } from './types';

const POLYGON_POINTS = [
  "88,77 184,146 244,191 281,217 336,259 355,272 358,272 367,267 372,266 379,262 391,258 433,239 440,237 473,222 513,206 520,202 546,192 555,187 558,187 446,102 433,91 421,83 403,68 397,65 392,60 331,15 318,4 274,19 264,21 246,28 239,29 217,37 214,37 211,39 201,41 189,46 186,46 154,57 151,57 148,59 141,60 138,62 104,73 101,73 98,75",
  "1323,77 1313,75 1292,67 1289,67 1239,50 1236,50 1233,48 1230,48 1189,34 1176,31 1094,4 1085,12 1074,19 1053,36 959,106 855,187 876,196 881,197 973,237 980,239 1034,263 1048,268 1055,272 1059,272 1139,213 1146,209 1177,185 1188,178 1208,162 1284,107",
  "70,97 70,334 71,335 72,350 76,365 104,429 108,435 180,486 184,490 245,534 345,609 339,293 305,269 281,250 252,230 182,177 179,176 153,156 150,155",
  "1342,97 1252,162 1248,166 1152,236 1148,240 1126,255 1122,259 1112,265 1103,273 1074,293 1073,296 1073,317 1072,318 1072,355 1071,356 1071,415 1070,416 1070,461 1069,462 1069,526 1068,527 1067,609 1306,433 1325,392 1336,365 1341,343 1341,331 1342,330",
  "682,361 576,210 381,292 532,410 577,395 580,395 586,392 595,390 613,384 616,382 622,381 664,367 667,365",
  "732,361 803,384 806,386 809,386 831,394 834,394 860,404 863,404 881,410 1033,291 837,210 764,315 760,319 759,322 740,348",
  "367,314 367,373 368,374 368,430 369,431 371,567 380,574 383,575 388,580 396,585 505,669 508,611 509,610 509,595 510,594 512,540 513,539 513,524 514,523 514,504 515,503 515,490 516,489 517,454 518,453 518,434 519,433 504,421 501,420 490,410 468,394 427,361 423,359 395,336 392,335",
  "1046,314 894,433 895,456 896,457 896,475 897,476 897,494 898,495 898,513 899,514 901,561 902,562 902,579 903,580 903,594 904,595 906,650 907,651 907,666 908,669 934,648 971,621 1041,567",
  "549,424 693,539 693,534 694,533 693,532 693,377 676,382 664,387 660,387 657,389 654,389 635,396 632,396",
  "864,424 815,407 812,407 791,400 779,395 776,395 721,377 721,539 732,529 736,527 752,513",
  "535,446 532,511 531,512 531,531 530,532 530,546 529,547 529,567 528,568 527,600 526,601 526,616 525,617 525,634 524,635 524,650 523,651 523,662 522,663 522,682 543,697 628,763 640,771 645,776 649,778 692,812 693,809 693,799 692,798 692,793 693,792 693,572 685,567 679,561 675,559 649,537 611,508 605,502 602,501",
  "878,446 721,572 721,594 720,595 720,775 721,776 720,780 721,781 721,812 752,787 756,785 816,738 892,681 891,669 890,668 890,650 889,649 889,633 888,632 888,619 887,618 885,567 884,566 884,554 883,553 883,532 882,531 882,513 881,512",
  "100,461 95,488 89,506 87,509 86,515 77,534 75,541 55,582 38,613 16,647 13,656 13,662 16,670 26,679 42,685 62,690 67,693 74,700 76,705 76,720 68,743 68,749 70,755 75,763 87,770 97,772 125,772 126,771 130,772 128,775 112,781 89,784 83,791 81,797 81,805 83,811 89,818 100,824 105,829 109,836 111,843 111,860 105,889 105,910 108,922 115,933 121,939 173,974 286,1057 326,1088 345,1105 345,641",
  "1312,462 1273,489 1230,522 1227,523 1143,586 1067,641 1067,1106 1080,1093 1135,1050 1138,1049 1172,1023 1235,978 1239,974 1249,968 1253,964 1256,963 1270,952 1292,938 1301,928 1305,920 1307,912 1308,897 1307,896 1307,888 1301,858 1302,839 1307,829 1312,824 1323,818 1328,813 1331,806 1331,796 1330,792 1324,784 1311,783 1297,780 1286,776 1282,773 1284,771 1287,772 1316,772 1328,769 1335,765 1340,760 1344,750 1344,742 1336,717 1336,706 1339,699 1344,694 1353,689 1371,685 1386,679 1394,673 1399,663 1399,655 1397,649 1372,610 1339,546 1321,500 1321,497 1316,484",
];

const SVG_W = 1407;
const SVG_H = 1118;
const OUTER_INDICES = [0, 1, 2, 3, 6, 7, 10, 11, 12, 13];
const INNER_INDICES = [4, 5, 8, 9];

// Unique flicker timing per polygon
const FLICKER_TIMING = [...OUTER_INDICES, ...INNER_INDICES].map((_, i) => ({
  on1:  80  + (i * 173) % 250,
  off1: 300 + (i * 251) % 600,
  on2:  50  + (i * 137) % 200,
  off2: 400 + (i * 317) % 500,
}));

function parsePoints(s: string) {
  const nums = s.trim().split(/[\s,]+/).map(Number);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

interface HolographicLogoProps {
  cx: number;
  cy: number;
  radius: number;
  mode: OrbMode;
  clock: SharedValue<number>;
  energy: SharedValue<number>;
}

export function HolographicLogo({ cx, cy, radius, mode, clock, energy }: HolographicLogoProps) {
  const size = radius * 1.28;
  const scale = size / Math.max(SVG_W, SVG_H);
  const offsetX = cx - (SVG_W * scale) / 2;
  const offsetY = cy - (SVG_H * scale) / 2;

  const paths = useMemo(() => {
    return POLYGON_POINTS.map((pts) => {
      const points = parsePoints(pts);
      const path = Skia.Path.Make();
      points.forEach((pt, i) => {
        const x = offsetX + pt.x * scale;
        const y = offsetY + pt.y * scale;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.close();
      return path;
    });
  }, [offsetX, offsetY, scale]);

  // 14 fixed shared values — never changes count so hooks rule is satisfied
  const f0  = useSharedValue(1); const f1  = useSharedValue(1);
  const f2  = useSharedValue(1); const f3  = useSharedValue(1);
  const f4  = useSharedValue(1); const f5  = useSharedValue(1);
  const f6  = useSharedValue(1); const f7  = useSharedValue(1);
  const f8  = useSharedValue(1); const f9  = useSharedValue(1);
  const f10 = useSharedValue(1); const f11 = useSharedValue(1);
  const f12 = useSharedValue(1); const f13 = useSharedValue(1);
  const flick = [f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13];

  const isActive = mode === 'userSpeaking' || mode === 'listening';

  useEffect(() => {
    if (isActive) {
      flick.forEach((sv, i) => {
        const t = FLICKER_TIMING[i];
        sv.value = withDelay(
          (i * 53) % 300,
          withRepeat(
            withSequence(
              withTiming(0.0, { duration: t.on1 }),
              withTiming(1.0, { duration: t.off1 }),
              withTiming(0.2, { duration: t.on2 }),
              withTiming(1.0, { duration: t.off2 }),
            ),
            -1, false,
          ),
        );
      });
    } else {
      flick.forEach((sv) => {
        cancelAnimation(sv);
        sv.value = withTiming(1.0, { duration: 400 });
      });
    }
    return () => flick.forEach((sv) => cancelAnimation(sv));
  }, [isActive]);

  // Derived opacity per polygon
  const o0  = useDerivedValue(() => f0.value);
  const o1  = useDerivedValue(() => f1.value);
  const o2  = useDerivedValue(() => f2.value);
  const o3  = useDerivedValue(() => f3.value);
  const o4  = useDerivedValue(() => f4.value);
  const o5  = useDerivedValue(() => f5.value);
  const o6  = useDerivedValue(() => f6.value);
  const o7  = useDerivedValue(() => f7.value);
  const o8  = useDerivedValue(() => f8.value);
  const o9  = useDerivedValue(() => f9.value);
  const o10 = useDerivedValue(() => f10.value);
  const o11 = useDerivedValue(() => f11.value);
  const o12 = useDerivedValue(() => f12.value);
  const o13 = useDerivedValue(() => f13.value);

  const outerOp = [o0, o1, o2, o3, o6, o7, o10, o11, o12, o13];
  const innerOp = [o4, o5, o8, o9];

  return (
    <Group>
      {/* Outer polygons — clean thin white lines, flicker on press */}
      {OUTER_INDICES.map((idx, k) => (
        <Path
          key={`outer-${idx}`}
          path={paths[idx]}
          style="stroke"
          strokeWidth={scale * 3.5}
          color="#FFFFFF"
          strokeCap="round"
          strokeJoin="round"
          opacity={outerOp[k]}
        />
      ))}

      {/* Inner polygons — dimmer, depth */}
      {INNER_INDICES.map((idx, k) => (
        <Path
          key={`inner-${idx}`}
          path={paths[idx]}
          style="stroke"
          strokeWidth={scale * 2.5}
          color="#7799BB"
          strokeCap="round"
          strokeJoin="round"
          opacity={innerOp[k]}
        />
      ))}
    </Group>
  );
}
