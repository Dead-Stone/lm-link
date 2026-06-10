import React, { useId } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

type Props = {
  size?: number;
};

/** Bordered 3D chain-link badge — matches launcher icon overlay. */
export default function LinkBadgeIcon({ size = 24 }: Props) {
  const uid = useId().replace(/:/g, "");
  const fillId = `linkBadgeFill-${uid}`;
  const borderId = `linkBadgeBorder-${uid}`;
  const ringFaceId = `linkRingFace-${uid}`;
  const ringEdgeId = `linkRingEdge-${uid}`;
  const ringInnerId = `linkRingInner-${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="0.55" stopColor="#F8F5FF" />
          <Stop offset="1" stopColor="#E9E3FF" />
        </LinearGradient>
        <LinearGradient id={borderId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#DDD6FE" />
          <Stop offset="0.45" stopColor="#A78BFA" />
          <Stop offset="1" stopColor="#6D5BB8" />
        </LinearGradient>
        <LinearGradient id={ringFaceId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="0.45" stopColor="#F2EEFF" />
          <Stop offset="1" stopColor="#D4CBFF" />
        </LinearGradient>
        <LinearGradient id={ringEdgeId} x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#B8A8F0" />
          <Stop offset="1" stopColor="#FFFFFF" />
        </LinearGradient>
        <LinearGradient id={ringInnerId} x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor="#9B8AD8" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#6E5BB8" stopOpacity={0.25} />
        </LinearGradient>
      </Defs>
      <Circle cx={48} cy={48} r={45} fill={`url(#${fillId})`} />
      <Circle
        cx={48}
        cy={48}
        r={45}
        fill="none"
        stroke={`url(#${borderId})`}
        strokeWidth={3.4}
      />
      <Ellipse cx={50} cy={58} rx={26} ry={9.5} fill="#12081F" opacity={0.24} />
      <G transform="translate(48 48) scale(0.76) translate(-48 -48) rotate(-38 48 48)">
        <Ellipse
          cx={34}
          cy={52}
          rx={17}
          ry={11}
          fill={`url(#${ringFaceId})`}
          stroke={`url(#${ringEdgeId})`}
          strokeWidth={3.2}
        />
        <Ellipse cx={34} cy={52} rx={9.5} ry={5.5} fill={`url(#${ringInnerId})`} />
        <Ellipse
          cx={58}
          cy={40}
          rx={17}
          ry={11}
          fill={`url(#${ringFaceId})`}
          stroke={`url(#${ringEdgeId})`}
          strokeWidth={3.2}
        />
        <Ellipse cx={58} cy={40} rx={9.5} ry={5.5} fill={`url(#${ringInnerId})`} />
        <Path
          d="M44 47 C48 44 52 42 56 40"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          opacity={0.7}
        />
        <Path
          d="M30 50 C28 48 28 45 30 43"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.55}
        />
      </G>
    </Svg>
  );
}
