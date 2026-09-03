// Shared bottom-sheet wrapper. RN's <Modal animationType="slide"> animates the
// WHOLE modal window (backdrop included) sliding up as one rigid block, which
// looks like the dim overlay itself is "sliding in" instead of appearing
// instantly while only the sheet content rises — exactly the jarring effect
// reported against every ad-hoc `<Modal transparent animationType="slide">`
// bottom sheet in this app. Fix: mount the Modal with no built-in animation,
// then separately fade the backdrop in and spring the sheet content up.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Animated, StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_H, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]} pointerEvents="box-none">
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
