import React from 'react';
import { Segmented, Typography } from 'antd';
import { useSettingsStore } from '../store/useSettingsStore';
import { VIENEU_MODE_INFO, getVieNeuVoices } from '../services/vieneuService';
import type { VieNeuMode } from '../types';

const { Text } = Typography;

/**
 * Picks the VieNeu model. The worker keeps only the selected one in memory, so Nano is the light
 * choice and Turbo the high-quality one. If the current VieNeu voice does not exist in the new
 * model, the first voice of that model is selected.
 */
export const VieNeuModeSwitch: React.FC = () => {
  const { vieneuMode, setVieneuMode, selectedVoiceURI, setSelectedVoiceURI } = useSettingsStore();

  const onChange = (mode: VieNeuMode) => {
    setVieneuMode(mode);
    if (selectedVoiceURI.startsWith('vieneu:')) {
      const list = getVieNeuVoices(mode);
      if (!list.some((v) => v.id === selectedVoiceURI)) setSelectedVoiceURI(list[0].id);
    }
  };

  return (
    <div>
      <Segmented
        block
        value={vieneuMode}
        onChange={(v) => onChange(v as VieNeuMode)}
        options={(Object.keys(VIENEU_MODE_INFO) as VieNeuMode[]).map((m) => ({
          value: m,
          label: VIENEU_MODE_INFO[m].label,
        }))}
      />
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
        {VIENEU_MODE_INFO[vieneuMode].sub}. Lần đầu dùng một model, server cần vài giây để nạp.
      </Text>
    </div>
  );
};
