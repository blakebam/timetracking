import {
  Defs,
  LinearGradient,
  Rect,
  Stop,
  Svg,
  Text,
  View,
  type Styles,
} from '@react-pdf/renderer';
import { colors, contentWidth, fontSize, fontWeight } from './theme';

type Style = Styles[string];

/** A 1 pt line across the content width, solid at the left and fading out to the right. */
export function FadeRule() {
  return (
    <Svg width={contentWidth} height={1}>
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.text} stopOpacity={1} />
          <Stop offset="0.55" stopColor={colors.text} stopOpacity={0.75} />
          <Stop offset="1" stopColor={colors.text} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={contentWidth} height={1} fill="url(#fade)" />
    </Svg>
  );
}

/** A small uppercase label over its value, both right-aligned (the invoice's top-right block). */
export function LabelValue({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: Style;
}) {
  return (
    <View style={[{ alignItems: 'flex-end' }, style ?? {}]}>
      <Text style={{ fontSize: fontSize.label }}>{label}</Text>
      <Text style={{ fontSize: fontSize.value, marginTop: 5 }}>{value}</Text>
    </View>
  );
}

/** "DRAFT" across the middle of every page, under the content. */
export function Watermark() {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: fontSize.watermark,
          fontWeight: fontWeight.medium,
          color: colors.watermark,
          transform: 'rotate(-45deg)',
        }}
      >
        DRAFT
      </Text>
    </View>
  );
}
