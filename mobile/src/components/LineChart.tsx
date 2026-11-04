import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/constants/theme';

import { T } from './ui';

export type Point = { x: number; y: number }; // x: timestamp (ms)

/** Small line chart with min/max labels. Points are spaced by time. */
export function LineChart({ points, height = 140, color, format = (v) => String(Math.round(v)) }: { points: Point[]; height?: number; color?: string; format?: (v: number) => string }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? c.accent;
  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  let [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  if (maxY - minY < 1e-9) [minY, maxY] = [minY - 1, maxY + 1];
  const pad = 6;
  const sx = (x: number) => (maxX === minX ? width / 2 : pad + ((x - minX) / (maxX - minX)) * (width - pad * 2));
  const sy = (y: number) => pad + (1 - (y - minY) / (maxY - minY)) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View style={{ gap: 4 }}>
      <T variant="caption">{format(Math.max(...ys))}</T>
      <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={height - 1} y2={height - 1} stroke={c.border} strokeWidth={1} />
            <Path d={d} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.length <= 40 && points.map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={stroke} />)}
            <Circle cx={sx(last.x)} cy={sy(last.y)} r={4.5} fill={stroke} />
          </Svg>
        )}
      </View>
      <T variant="caption">{format(Math.min(...ys))}</T>
    </View>
  );
}
