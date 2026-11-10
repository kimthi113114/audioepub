import React from 'react';
import { Button, Drawer, Space, Typography, theme as antdTheme } from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  StepForwardOutlined,
  StepBackwardOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  UpOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  ReadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatVoiceInfo } from '../utils/voiceHelper';
import type { PlaybackState, SleepTimerState } from '../types';
import type { SentenceGapMs } from '../types';

const { Text } = Typography;

const RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const SENTENCE_GAPS: SentenceGapMs[] = [0, 100, 200, 300];

const SentenceGapControl: React.FC = () => {
  const { sentenceGapMs, setSentenceGapMs } = useSettingsStore();
  return (
    <div role="group" aria-label="Nghỉ giữa các câu">
      <Text type="secondary" style={{ fontSize: 12 }}>Nghỉ giữa các câu</Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 6 }}>
        {SENTENCE_GAPS.map((gap) => (
          <Button
            key={gap}
            type={sentenceGapMs === gap ? 'primary' : 'default'}
            aria-label={`Nghỉ giữa các câu ${gap} ms`}
            aria-pressed={sentenceGapMs === gap}
            onClick={() => setSentenceGapMs(gap)}
            style={{ height: 44, padding: '0 4px' }}
          >
            {gap} ms
          </Button>
        ))}
      </div>
    </div>
  );
};

export interface PlayerProps {
  mode?: 'sidebar' | 'mobile';
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onNextSentence: () => void;
  onPrevSentence: () => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
  onClose: () => void;
  onOpenTimer: () => void;
  onOpenVoice: () => void;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  chapterTitle: string;
  chapterIndex: number;
  totalChapters: number;
  sentenceIndex: number;
  totalSentences: number;
  bookTitle?: string;
  bookCoverUrl?: string;
  sleepTimer: SleepTimerState;
}

const formatTimer = (t: SleepTimerState): string => {
  if (!t.isActive) return '';
  if (t.targetMode === 'chapter') return 'Hết chương';
  const m = Math.floor(t.remainingSeconds / 60);
  const s = t.remainingSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Listen mode UI: a 64px mini-player docked at the bottom plus a full bottom-sheet player.
 * Only one of them is the "main" surface; the reader text stays visible behind the mini-player.
 */
export const Player: React.FC<PlayerProps> = ({
  mode,
  playbackState,
  onPlay,
  onPause,
  onNextSentence,
  onPrevSentence,
  onNextChapter,
  onPrevChapter,
  onClose,
  onOpenTimer,
  onOpenVoice,
  sheetOpen,
  onSheetOpenChange,
  chapterTitle,
  chapterIndex,
  totalChapters,
  sentenceIndex,
  totalSentences,
  bookTitle,
  bookCoverUrl,
  sleepTimer,
}) => {
  const { token } = antdTheme.useToken();
  const { speechRate, setSpeechRate, selectedVoiceURI } = useSettingsStore();
  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';
  const toggle = isPlaying || isLoading ? onPause : onPlay;
  const progress = totalSentences > 0 ? ((sentenceIndex + 1) / totalSentences) * 100 : 0;
  const timerLabel = formatTimer(sleepTimer);
  const voiceName = formatVoiceInfo(selectedVoiceURI).displayName;

  const playIcon = isLoading ? (
    <LoadingOutlined style={{ fontSize: 26 }} />
  ) : isPlaying ? (
    <PauseCircleFilled style={{ fontSize: 30 }} />
  ) : (
    <PlayCircleFilled style={{ fontSize: 30 }} />
  );

  // Desktop Left Sidebar Layout
  if (mode === 'sidebar') {
    return (
      <div
        role="region"
        aria-label="Trình phát âm thanh"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '20px 18px 24px',
          boxSizing: 'border-box',
          gap: 16,
          background: 'var(--surface)',
        }}
      >
        {/* Top Header of Sidebar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CustomerServiceOutlined style={{ color: 'var(--primary)', fontSize: 16 }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: 'var(--primary)',
              }}
            >
              Đang nghe sách
            </span>
          </div>
          <Button
            type="text"
            icon={<CloseOutlined />}
            size="small"
            onClick={onClose}
            title="Dừng nghe & đóng trình phát"
            style={{ borderRadius: 6, color: 'var(--muted)', fontSize: 12 }}
          >
            Dừng nghe
          </Button>
        </div>

        {/* Book Artwork & Titles */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '4px 0' }}>
          {bookCoverUrl ? (
            <img
              src={bookCoverUrl}
              alt=""
              style={{
                width: 76,
                height: 106,
                objectFit: 'cover',
                borderRadius: 8,
                flexShrink: 0,
                boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
              }}
            />
          ) : (
            <div
              style={{
                width: 76,
                height: 106,
                borderRadius: 8,
                background: token.colorFillSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            >
              <CustomerServiceOutlined style={{ fontSize: 30, opacity: 0.5 }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.3,
                marginBottom: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
              title={bookTitle}
            >
              {bookTitle}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted)',
                lineHeight: 1.3,
                marginBottom: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={chapterTitle}
            >
              {chapterTitle}
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--primary)',
                background: 'var(--primary-soft)',
                padding: '2px 8px',
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              Chương {chapterIndex + 1}/{totalChapters || 1}
            </span>
          </div>
        </div>

        {/* Progress bar in Chapter */}
        <div style={{ padding: '2px 0' }}>
          <div style={{ height: 4, background: token.colorFillSecondary, borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: 4,
                width: `${progress}%`,
                background: token.colorPrimary,
                borderRadius: 2,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Câu {totalSentences > 0 ? sentenceIndex + 1 : 0}/{totalSentences}
            </Text>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
              {Math.round(progress)}%
            </Text>
          </div>
        </div>

        {/* Playback Controls (Row of 5 buttons) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
          <Button
            type="text"
            shape="circle"
            title="Chương trước"
            aria-label="Chương trước"
            icon={<DoubleLeftOutlined />}
            onClick={onPrevChapter}
            disabled={chapterIndex <= 0}
            style={{ width: 40, height: 40 }}
          />
          <Button
            type="text"
            shape="circle"
            title="Câu trước"
            aria-label="Câu trước"
            icon={<StepBackwardOutlined style={{ fontSize: 18 }} />}
            onClick={onPrevSentence}
            style={{ width: 44, height: 44 }}
          />
          <Button
            type="primary"
            shape="circle"
            aria-label={isPlaying || isLoading ? 'Tạm dừng' : 'Phát'}
            icon={
              isLoading ? (
                <LoadingOutlined style={{ fontSize: 26 }} />
              ) : isPlaying ? (
                <PauseCircleFilled style={{ fontSize: 30 }} />
              ) : (
                <PlayCircleFilled style={{ fontSize: 30 }} />
              )
            }
            onClick={toggle}
            style={{ width: 62, height: 62, boxShadow: '0 6px 18px var(--primary-soft)' }}
          />
          <Button
            type="text"
            shape="circle"
            title="Câu sau"
            aria-label="Câu sau"
            icon={<StepForwardOutlined style={{ fontSize: 18 }} />}
            onClick={onNextSentence}
            style={{ width: 44, height: 44 }}
          />
          <Button
            type="text"
            shape="circle"
            title="Chương sau"
            aria-label="Chương sau"
            icon={<DoubleRightOutlined />}
            onClick={onNextChapter}
            disabled={chapterIndex >= totalChapters - 1}
            style={{ width: 40, height: 40 }}
          />
        </div>

        {/* Speed Selector */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
            Tốc độ đọc
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {RATES.map((r) => (
              <Button
                key={r}
                type={speechRate === r ? 'primary' : 'default'}
                onClick={() => setSpeechRate(r)}
                size="small"
                style={{
                  height: 32,
                  padding: 0,
                  fontSize: 12,
                  fontWeight: speechRate === r ? 700 : 400,
                  borderRadius: 6,
                }}
              >
                {r}x
              </Button>
            ))}
          </div>
        </div>

        <SentenceGapControl />

        {/* Feature Actions (Timer & Voice) */}
        <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 'auto' }}>
          <Button
            block
            icon={<ClockCircleOutlined />}
            onClick={onOpenTimer}
            style={{
              height: 42,
              textAlign: 'left',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Hẹn giờ ngủ{timerLabel ? ` · ${timerLabel}` : ''}
          </Button>
          <Button
            block
            icon={<CustomerServiceOutlined />}
            onClick={onOpenVoice}
            style={{
              height: 42,
              textAlign: 'left',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Giọng: {voiceName}
            </span>
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <>
      {/* Mini player */}
      <div
        role="region"
        aria-label="Trình phát"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 60,
          background: token.colorBgElevated,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          paddingBottom: 'var(--sab, 0px)',
        }}
      >
        <div style={{ height: 2, background: token.colorFillSecondary }}>
          <div style={{ height: 2, width: `${progress}%`, background: token.colorPrimary }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', minHeight: 60 }}>
          <Button
            type="text"
            aria-label="Mở trình phát"
            onClick={() => onSheetOpenChange(true)}
            style={{ flex: 1, minWidth: 0, height: 48, textAlign: 'left', padding: '0 8px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <UpOutlined style={{ opacity: 0.5, flexShrink: 0 }} />
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <Text strong ellipsis style={{ fontSize: 13 }}>
                {chapterTitle}
              </Text>
              <Text type="secondary" ellipsis style={{ fontSize: 11 }}>
                {timerLabel ? `⏾ ${timerLabel} · ` : ''}
                {speechRate}x · {totalSentences > 0 ? `${sentenceIndex + 1}/${totalSentences}` : '...'}
              </Text>
            </span>
          </Button>
          <Button type="text" shape="circle" size="large" aria-label="Câu trước" icon={<StepBackwardOutlined />} onClick={onPrevSentence} style={{ width: 44, height: 44 }} />
          <Button type="text" shape="circle" aria-label={isPlaying || isLoading ? 'Tạm dừng' : 'Phát'} icon={playIcon} onClick={toggle} style={{ width: 48, height: 48, color: token.colorPrimary }} />
          <Button type="text" shape="circle" size="large" aria-label="Câu sau" icon={<StepForwardOutlined />} onClick={onNextSentence} style={{ width: 44, height: 44 }} />
        </div>
      </div>

      {/* Full player */}
      <Drawer
        placement="bottom"
        open={sheetOpen}
        onClose={() => onSheetOpenChange(false)}
        size="85dvh"
        closable={false}
        title={null}
        styles={{
          body: { padding: '12px 20px', paddingBottom: 'calc(var(--sab, 0px) + 16px)', display: 'flex', flexDirection: 'column', gap: 20 },
          header: { display: 'none' },
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="text" icon={<ReadOutlined />} onClick={() => onSheetOpenChange(false)} style={{ height: 44 }}>
            Về chế độ Đọc
          </Button>
          <Button type="text" icon={<CloseOutlined />} aria-label="Dừng nghe" onClick={() => { onSheetOpenChange(false); onClose(); }} style={{ width: 44, height: 44 }} />
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {bookCoverUrl ? (
            <img src={bookCoverUrl} alt="" style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 72, height: 96, borderRadius: 8, background: token.colorFillSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CustomerServiceOutlined style={{ fontSize: 28, opacity: 0.5 }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 16, display: 'block' }} ellipsis>
              {bookTitle}
            </Text>
            <Text type="secondary" style={{ display: 'block' }} ellipsis>
              {chapterTitle}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Chương {chapterIndex + 1}/{totalChapters || 1}
            </Text>
          </div>
        </div>

        <div>
          <div style={{ height: 4, background: token.colorFillSecondary, borderRadius: 2 }}>
            <div style={{ height: 4, width: `${progress}%`, background: token.colorPrimary, borderRadius: 2 }} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Câu {totalSentences > 0 ? sentenceIndex + 1 : 0}/{totalSentences} trong chương
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="text" shape="circle" aria-label="Chương trước" icon={<DoubleLeftOutlined />} onClick={onPrevChapter} disabled={chapterIndex <= 0} style={{ width: 48, height: 48 }} />
          <Button type="text" shape="circle" aria-label="Câu trước" icon={<StepBackwardOutlined style={{ fontSize: 20 }} />} onClick={onPrevSentence} style={{ width: 52, height: 52 }} />
          <Button type="primary" shape="circle" aria-label={isPlaying || isLoading ? 'Tạm dừng' : 'Phát'} icon={isLoading ? <LoadingOutlined style={{ fontSize: 30 }} /> : isPlaying ? <PauseCircleFilled style={{ fontSize: 34 }} /> : <PlayCircleFilled style={{ fontSize: 34 }} />} onClick={toggle} style={{ width: 72, height: 72 }} />
          <Button type="text" shape="circle" aria-label="Câu sau" icon={<StepForwardOutlined style={{ fontSize: 20 }} />} onClick={onNextSentence} style={{ width: 52, height: 52 }} />
          <Button type="text" shape="circle" aria-label="Chương sau" icon={<DoubleRightOutlined />} onClick={onNextChapter} disabled={chapterIndex >= totalChapters - 1} style={{ width: 48, height: 48 }} />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Tốc độ</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {RATES.map((r) => (
              <Button key={r} type={speechRate === r ? 'primary' : 'default'} onClick={() => setSpeechRate(r)} style={{ minWidth: 56, height: 40 }}>
                {r}x
              </Button>
            ))}
          </div>
        </div>

        <SentenceGapControl />

        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Button block size="large" icon={<ClockCircleOutlined />} onClick={onOpenTimer} style={{ height: 48, textAlign: 'left' }}>
            Hẹn giờ ngủ{timerLabel ? ` · ${timerLabel}` : ''}
          </Button>
          <Button block size="large" icon={<CustomerServiceOutlined />} onClick={onOpenVoice} style={{ height: 48, textAlign: 'left' }}>
            Giọng: {voiceName}
          </Button>
        </Space>
      </Drawer>
    </>
  );
};
