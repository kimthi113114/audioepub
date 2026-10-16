import React from 'react';
import { Button, Space, Typography, Tooltip, Badge, Dropdown, type MenuProps } from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  BgColorsOutlined,
  FontSizeOutlined,
  AppleOutlined,
  BookOutlined,
  UploadOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import type { SleepTimerState } from '../types';

const { Text } = Typography;

interface NavbarProps {
  currentBookTitle?: string;
  onBackToShelf?: () => void;
  onOpenTimerModal: () => void;
  onOpenIOSGuide: () => void;
  onOpenVoiceModal?: () => void;
  onOpenUpload?: () => void;
  sleepTimer: SleepTimerState;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentBookTitle,
  onBackToShelf,
  onOpenTimerModal,
  onOpenIOSGuide,
  onOpenVoiceModal,
  onOpenUpload,
  sleepTimer,
}) => {
  const { setTheme, fontSize, setFontSize, readingMode, setReadingMode } =
    useSettingsStore();

  const themeMenuItems: MenuProps['items'] = [
    {
      key: 'light',
      label: 'Sáng (Light)',
      onClick: () => setTheme('light'),
    },
    {
      key: 'sepia',
      label: 'Vàng ấm (Sepia)',
      onClick: () => setTheme('sepia'),
    },
    {
      key: 'dark',
      label: 'Tối (Dark)',
      onClick: () => setTheme('dark'),
    },
  ];

  const fontMenuItems: MenuProps['items'] = [
    {
      key: 'font-dec',
      label: 'Cỡ chữ nhỏ hơn (A-)',
      onClick: () => setFontSize(Math.max(14, fontSize - 2)),
    },
    {
      key: 'font-cur',
      label: `Cỡ chữ hiện tại: ${fontSize}px`,
      disabled: true,
    },
    {
      key: 'font-inc',
      label: 'Cỡ chữ lớn hơn (A+)',
      onClick: () => setFontSize(Math.min(32, fontSize + 2)),
    },
    {
      type: 'divider',
    },
    {
      key: 'mode-toggle',
      label: readingMode === 'continuous' ? 'Chế độ: Cuộn dọc' : 'Chế độ: Lật trang',
      onClick: () =>
        setReadingMode(readingMode === 'continuous' ? 'paginated' : 'continuous'),
    },
  ];

  const formatTimerLabel = () => {
    if (!sleepTimer.isActive) return '';
    if (sleepTimer.targetMode === 'chapter') return 'Hết chương';
    const m = Math.floor(sleepTimer.remainingSeconds / 60);
    const s = sleepTimer.remainingSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        paddingTop: 'var(--sat, 0px)',
        height: 'calc(56px + var(--sat, 0px))',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: 'inherit',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {/* Left: Brand or Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
        {currentBookTitle ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBackToShelf}
            style={{ padding: '4px 8px' }}
          >
            Thư viện
          </Button>
        ) : (
          <Space align="center" size={6} style={{ flexShrink: 0 }}>
            <BookOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Text
              strong
              style={{
                fontSize: 17,
                letterSpacing: -0.5,
                whiteSpace: 'nowrap',
              }}
            >
              AudioEpub
            </Text>
          </Space>
        )}

        {currentBookTitle && (
          <Text
            ellipsis
            strong
            style={{
              maxWidth: 'min(180px, 35vw)',
              fontSize: 14,
            }}
          >
            {currentBookTitle}
          </Text>
        )}
      </div>

      {/* Right: Actions */}
      <Space size={6} style={{ flexShrink: 0 }}>
        {onOpenUpload && (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={onOpenUpload}
            size="middle"
          >
            <span className="hide-on-mobile">Thêm sách</span>
          </Button>
        )}

        <Tooltip title="Mẹo tối ưu iOS Safari">
          <Button
            type="text"
            icon={<AppleOutlined />}
            onClick={onOpenIOSGuide}
            style={{ fontSize: 16 }}
          />
        </Tooltip>

        {onOpenVoiceModal && (
          <Tooltip title="Chọn & Nghe thử giọng đọc">
            <Button
              type="text"
              icon={<CustomerServiceOutlined style={{ color: '#1677ff' }} />}
              onClick={onOpenVoiceModal}
              style={{ fontSize: 16 }}
            />
          </Tooltip>
        )}

        <Dropdown menu={{ items: themeMenuItems }} placement="bottomRight" trigger={['click']}>
          <Tooltip title="Chế độ màu">
            <Button type="text" icon={<BgColorsOutlined />} />
          </Tooltip>
        </Dropdown>

        {currentBookTitle && (
          <Dropdown menu={{ items: fontMenuItems }} placement="bottomRight" trigger={['click']}>
            <Tooltip title="Cỡ chữ & Chế độ xem">
              <Button type="text" icon={<FontSizeOutlined />} />
            </Tooltip>
          </Dropdown>
        )}

        <Badge dot={sleepTimer.isActive} color="#52c41a">
          <Button
            type={sleepTimer.isActive ? 'primary' : 'default'}
            icon={<ClockCircleOutlined />}
            onClick={onOpenTimerModal}
            size="middle"
            style={{
              borderRadius: 16,
              fontSize: 13,
            }}
          >
            {sleepTimer.isActive ? formatTimerLabel() : <span className="hide-on-mobile">Hẹn giờ</span>}
          </Button>
        </Badge>
      </Space>
    </header>
  );
};
