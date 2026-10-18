import React, { useState, useEffect } from 'react';
import { Button, Space, Select, Slider, Popover, Typography, Tooltip } from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  StepForwardOutlined,
  StepBackwardOutlined,
  SoundOutlined,
  CustomerServiceOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import type { PlaybackState } from '../types';
import { formatVoiceInfo } from '../utils/voiceHelper';
import { PIPER_VOICES } from '../utils/piperVoices';
import { EDGE_VOICES } from '../services/edgeTTSService';

const { Text } = Typography;

interface PlayerBarProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentSentence: string;
  currentSentenceIndex: number;
  totalSentences: number;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  onOpenVoiceModal?: () => void;
  onOpenVoiceDrawer?: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  playbackState,
  onPlay,
  onPause,
  onNext,
  onPrev,
  currentSentence,
  currentSentenceIndex,
  totalSentences,
  voices,
  vietnameseVoices,
  onOpenVoiceModal,
  onOpenVoiceDrawer,
}) => {
  const {
    speechRate,
    setSpeechRate,
    volume,
    setVolume,
    selectedVoiceURI,
    setSelectedVoiceURI,
    setNeuralSpeakerId,
    setTtsEngine,
    setEngineMode,
  } = useSettingsStore();

  // Responsive state: check if screen is mobile (< 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPlaying = playbackState === 'playing';

  // System voices separation
  const otherVoices = voices.filter((v) => !vietnameseVoices.includes(v));

  // Voice options grouped cleanly with compact labels (preventing rc-trigger negative coordinates)
  const voiceOptions = [
    {
      label: '🌟 Giọng AI Studio 24kHz (Khuyên dùng)',
      options: EDGE_VOICES.map((ev) => ({
        label: `${ev.name} (${ev.badge})`,
        value: ev.id,
      })),
    },
    {
      label: '📱 Giọng Trình Duyệt (Web Speech)',
      options: vietnameseVoices.map((v) => {
        const info = formatVoiceInfo(v);
        return {
          label: `${info.displayName} (${info.badge})`,
          value: v.voiceURI,
        };
      }),
    },
    {
      label: '🌍 Giọng Đọc Quốc Tế',
      options: otherVoices.slice(0, 10).map((v) => ({
        label: `${v.name.slice(0, 20)} (${v.lang})`,
        value: v.voiceURI,
      })),
    },
  ];

  const handleVoiceSelect = (val: string) => {
    setSelectedVoiceURI(val);
    if (
      val === 'vi-VN-HoaiMyNeural' ||
      val === 'vi-VN-NamMinhNeural' ||
      val.endsWith('Neural') ||
      EDGE_VOICES.some((ev) => ev.id === val)
    ) {
      setTtsEngine('edge');
      setEngineMode('edge');
    } else if (val.startsWith('piper:')) {
      const piperVoice = PIPER_VOICES.find((pv) => pv.id === val);
      if (piperVoice) {
        setNeuralSpeakerId(piperVoice.speakerId);
      }
      setTtsEngine('neural_piper');
      setEngineMode('neural');
    } else {
      setTtsEngine('webspeech');
      setEngineMode('system');
    }
  };

  const currentVoiceInfo = formatVoiceInfo(selectedVoiceURI);

  const rateOptions = [
    { label: '0.75x', value: 0.75 },
    { label: '1.0x', value: 1.0 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '1.75x', value: 1.75 },
    { label: '2.0x', value: 2.0 },
  ];

  const volumeContent = (
    <div style={{ width: 140, padding: 8 }}>
      <Text style={{ fontSize: 12 }}>Âm lượng: {Math.round(volume * 100)}%</Text>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(val) => setVolume(val)}
      />
    </div>
  );

  const handleOpenVoiceSettings = () => {
    if (isMobile && onOpenVoiceDrawer) {
      onOpenVoiceDrawer();
    } else if (onOpenVoiceModal) {
      onOpenVoiceModal();
    } else if (onOpenVoiceDrawer) {
      onOpenVoiceDrawer();
    }
  };

  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        paddingBottom: 'calc(var(--sab, 0px) + 8px)',
        background: 'rgba(255, 255, 255, 0.94)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Active Sentence Subtitle Preview */}
      {currentSentence && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            lineHeight: 1.4,
            color: '#475569',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 8px',
          }}
        >
          <Text italic style={{ color: '#0284c7' }}>
            {`[${totalSentences > 0 ? `${currentSentenceIndex + 1}/${totalSentences}` : '...'}] `}
          </Text>
          <span>{currentSentence}</span>
        </div>
      )}

      {/* Controls Container: Sleek Single-Row Layout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: 6,
        }}
      >
        {/* Left: Voice Selector & Settings */}
        <Space size={4} style={{ flexShrink: 1, minWidth: 0, maxWidth: 175 }}>
          {isMobile ? (
            /* On mobile screen (< 768px): Touch trigger opening VoiceDrawer bottom sheet */
            <Button
              size="small"
              onClick={handleOpenVoiceSettings}
              style={{
                maxWidth: 135,
                minWidth: 92,
                height: 28,
                padding: '0 8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                borderRadius: 6,
                borderColor: '#d9d9d9',
                background: '#ffffff',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  flex: 1,
                  fontWeight: 500,
                  color: '#1e293b',
                }}
              >
                {currentVoiceInfo.displayName}
              </span>
              <DownOutlined style={{ fontSize: 9, marginLeft: 4, opacity: 0.5, flexShrink: 0 }} />
            </Button>
          ) : (
            /* On desktop: Rock-solid Select with topLeft placement and safe popup container */
            <Select
              size="small"
              style={{ width: 138 }}
              placement="topLeft"
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
              dropdownStyle={{
                minWidth: 240,
                maxWidth: 320,
                maxHeight: 360,
                overflowY: 'auto',
                boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)',
              }}
              popupMatchSelectWidth={false}
              placeholder="Giọng đọc"
              value={selectedVoiceURI || undefined}
              onChange={handleVoiceSelect}
              options={voiceOptions}
            />
          )}

          <Tooltip title="Danh sách & Nghe thử giọng đọc">
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={<CustomerServiceOutlined style={{ fontSize: 16, color: '#1677ff' }} />}
              onClick={handleOpenVoiceSettings}
            />
          </Tooltip>
        </Space>

        {/* Center: Playback Buttons */}
        <Space size={8} align="center" style={{ flexShrink: 0 }}>
          <Tooltip title="Câu trước">
            <Button
              type="text"
              shape="circle"
              size="middle"
              icon={<StepBackwardOutlined style={{ fontSize: 16 }} />}
              onClick={onPrev}
            />
          </Tooltip>

          <Button
            type="primary"
            shape="circle"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(22, 119, 255, 0.35)',
            }}
            icon={
              isPlaying ? (
                <PauseCircleFilled style={{ fontSize: 24 }} />
              ) : (
                <PlayCircleFilled style={{ fontSize: 24, marginLeft: 2 }} />
              )
            }
            onClick={isPlaying ? onPause : onPlay}
          />

          <Tooltip title="Câu tiếp theo">
            <Button
              type="text"
              shape="circle"
              size="middle"
              icon={<StepForwardOutlined style={{ fontSize: 16 }} />}
              onClick={onNext}
            />
          </Tooltip>
        </Space>

        {/* Right: Speed & Volume */}
        <Space size={4} align="center" style={{ flexShrink: 0 }}>
          <Select
            size="small"
            style={{ width: 68 }}
            value={speechRate}
            onChange={(val) => setSpeechRate(val)}
            options={rateOptions}
          />

          <Popover content={volumeContent} trigger="click" placement="topRight">
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={<SoundOutlined style={{ fontSize: 15 }} />}
            />
          </Popover>
        </Space>
      </div>
    </footer>
  );
};
