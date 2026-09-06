import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName = 'home' | 'receipt' | 'person' | 'people' | 'camera' | 'back' | 'arrow' | 'plus' | 'check' | 'settings' | 'share' | 'copy' | 'moon';
export function Icon({ name, color = '#096544', size = 22 }: { name: IconName; color?: string; size?: number }) {
  const paths: Partial<Record<IconName, string>> = {
    home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 4h6M9 11h6M9 15h3',
    camera: 'M8 6 9.5 3h5L16 6h4a1 1 0 0 1 1 1v12H3V7a1 1 0 0 1 1-1h4Z',
    back: 'm14 5-7 7 7 7', arrow: 'M4 12h15m-6-6 6 6-6 6', plus: 'M12 5v14M5 12h14',
    check: 'm5 12 4 4L19 6', share: 'M12 15V3m-4 4 4-4 4 4M6 10H4v11h16V10h-2',
    copy: 'M8 7V3h12v14h-4M4 7h12v14H4Z',
    moon: 'M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z',
    settings: 'm9 3-1 3-3 1-2 3 2 2-1 3 3 2 2 3h4l1-3 3-1 2-3-2-2 1-3-3-2-2-3Z',
    person: 'M4 21v-2a8 8 0 0 1 16 0v2', people: 'M3 20v-2a5 5 0 0 1 10 0v2m2-7a5 5 0 0 1 6 5v2',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <Path d={paths[name]} />
    {name === 'camera' && <Circle cx="12" cy="12" r="3.4" />}
    {name === 'person' && <Circle cx="12" cy="6" r="3.5" />}
    {name === 'people' && <><Circle cx="8" cy="7" r="3" /><Path d="M16 4a3 3 0 0 1 0 6" /></>}
    {name === 'settings' && <Circle cx="11.5" cy="11.5" r="3" />}
  </Svg>;
}
