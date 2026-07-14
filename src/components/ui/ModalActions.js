import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';

export default function ModalActions({
  cancelLabel, confirmLabel, onCancel, onConfirm, disabled, loading, confirmFlex = 1,
}) {
  return (
    <>
      <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
        <Text style={s.cancelTxt}>{cancelLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.confirmBtn, { flex: confirmFlex }, disabled && { opacity: 0.4 }]}
        onPress={onConfirm}
        disabled={disabled}
      >
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.confirmTxt}>{confirmLabel}</Text>}
      </TouchableOpacity>
    </>
  );
}

const s = StyleSheet.create({
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.bgMuted },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
