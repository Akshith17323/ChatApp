import { Platform } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';

const easing = Easing.bezier(0.22, 1, 0.36, 1);
const entrance = FadeInDown.duration(220);

// shortcut: custom web entrances freeze layout in Reanimated 4.7; revisit after its cleanup fix.
export const motion = {
  enter: (Platform.OS === 'web' ? entrance : entrance.withInitialValues({ translateY: 8 }))
    .easing(easing),
  fade: FadeIn.duration(160),
  exit: FadeOut.duration(120),
  pop: (Platform.OS === 'web' ? FadeIn.duration(160) : ZoomIn.duration(180).withInitialValues({ scale: 0.88 }))
    .easing(easing),
  layout: LinearTransition.duration(200).easing(easing),
  spring: { damping: 22, stiffness: 320, mass: 0.6, overshootClamping: true },
};
