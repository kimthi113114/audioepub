import React from 'react';
import { Button, Space, Select, Slider, Popover, Typography, Tooltip } from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  StepForwardOutlined,
  StepBackwardOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import type { PlaybackState } from '../types';

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
}) => {
  const {
    speechRate,
    setSpeechRate,
    volume,
    setVolume,
    selectedVoiceURI,
    setSelectedVoiceURI,
  } = useSettingsStore();

  const isPlaying = playbackState === 'playing';

  // Voice options grouped: Vietnamese first, then others
  const otherVoices = voices.filter((v) => !vietnameseVoices.includes(v));

  const voiceOptions = [
    {
      label: 'Giọng đọc Tiếng Việt',
      options: vietnameseVoices.map((v) => ({
        label: `${v.name} (${v.lang})`,
        value: v.voiceURI,
      })),
    },
    {
      label: 'Giọng đọc Quốc tế khác',
      options: otherVoices.slice(0, 15).map((v) => ({
        label: `${v.name} (${v.lang})`,
        value: v.voiceURI,
      })),
    },
  ];

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

  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        paddingBottom: 'calc(var(--sab, 0px) + 8px)',
        background: 'rgba(255, 255, 255, 0.92)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
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
        {/* Left: Voice Selector */}
        <div style={{ flexShrink: 1, minWidth: 0, maxWidth: 140 }}>
          <Select
            size="small"
            style={{ width: '100%' }}
            placeholder="Giọng đọc"
            value={selectedVoiceURI || undefined}
            onChange={(val) => setSelectedVoiceURI(val)}
            options={voiceOptions}
            popupMatchSelectWidth={false}
          />
        </div>

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
