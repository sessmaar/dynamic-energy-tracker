import { type ReactNode } from "react";
import { Text as RNText, type TextStyle } from "react-native";
import { colors, fonts, fontSize, fontWeight, letterSpacing } from "./tokens";

type Variant = "h1" | "h2" | "h3" | "lead" | "body" | "meta" | "eyebrow" | "num" | "bignum";

const variantStyle: Record<Variant, TextStyle> = {
  h1: {
    fontFamily: fonts.display,
    fontSize: fontSize.hero,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.display,
    color: colors.fg,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.display * 0.6,
    color: colors.fg,
  },
  h3: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    color: colors.fg,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: fontSize.lead,
    fontWeight: fontWeight.regular,
    color: colors.fg,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: colors.fg,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.meta,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: letterSpacing.tight,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: letterSpacing.wide,
  },
  num: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: colors.fg,
    fontVariant: ["tabular-nums"],
  },
  bignum: {
    fontFamily: fonts.mono,
    fontSize: fontSize.bignum,
    fontWeight: fontWeight.black,
    color: colors.fg,
    fontVariant: ["tabular-nums"],
    letterSpacing: -1.5,
  },
};

export interface TextProps {
  variant?: Variant;
  color?: string;
  style?: TextStyle | TextStyle[];
  children: ReactNode;
  numberOfLines?: number;
}

export const Text = ({ variant = "body", color, style, children, numberOfLines }: TextProps) => {
  const merged: TextStyle = { ...variantStyle[variant], ...(color ? { color } : {}) };
  return (
    <RNText style={[merged, style]} numberOfLines={numberOfLines} allowFontScaling={false}>
      {children}
    </RNText>
  );
};
