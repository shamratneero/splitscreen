import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, Ellipse } from 'react-native-svg';

export function ReceiptArt() {
  return <Svg width="224" height="180" viewBox="0 0 224 180" accessibilityLabel="A receipt surrounded by friends" role="img">
    <Defs>
      <LinearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF" /><Stop offset="1" stopColor="#E4EAE4" /></LinearGradient>
      <LinearGradient id="green" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#54B389" /><Stop offset="1" stopColor="#095C3F" /></LinearGradient>
      <LinearGradient id="warm" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFD797" /><Stop offset="1" stopColor="#D99549" /></LinearGradient>
    </Defs>
    <Ellipse cx="111" cy="161" rx="83" ry="9" fill="#154C30" opacity=".07" />
    <Path d="M79 17h66a9 9 0 0 1 9 9v113l-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4-8-4-8 4V26a9 9 0 0 1 9-9Z" fill="url(#paper)" stroke="#DAE2D9" />
    <Path d="M92 37h43M92 50h28M92 68h43M92 80h32M92 95h43M92 108h20" stroke="#BCC9BF" strokeWidth="3" strokeLinecap="round" />
    <Circle cx="49" cy="110" r="13" fill="url(#warm)" /><Path d="M29 150c0-31 40-31 40 0Z" fill="url(#warm)" stroke="#FFF" strokeWidth="1.5" />
    <Circle cx="177" cy="108" r="13" fill="url(#green)" opacity=".7" /><Path d="M157 148c0-31 40-31 40 0Z" fill="url(#green)" opacity=".7" stroke="#FFF" strokeWidth="1.5" />
    <Circle cx="96" cy="128" r="15" fill="url(#green)" stroke="#FFF" strokeWidth="1.5" /><Path d="M73 168c0-36 46-36 46 0Z" fill="url(#green)" stroke="#FFF" strokeWidth="1.5" />
    <Circle cx="139" cy="140" r="10" fill="url(#warm)" /><Path d="M124 168c0-25 30-25 30 0Z" fill="url(#warm)" stroke="#FFF" strokeWidth="1.5" />
  </Svg>;
}
