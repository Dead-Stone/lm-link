import React from "react";
import Svg, { Path } from "react-native-svg";

/** Official Microsoft four-square window mark. */
export default function MicrosoftColorLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#F25022" d="M0 0v11.408h11.408V0z" />
      <Path fill="#7FBA00" d="M12.594 0v11.408H24V0z" />
      <Path fill="#00A4EF" d="M0 12.594V24h11.408V12.594z" />
      <Path fill="#FFB900" d="M12.594 12.594V24H24V12.594z" />
    </Svg>
  );
}
