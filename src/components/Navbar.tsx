import React from 'react';
import { Button, Space, Typography, Badge, Dropdown, type MenuProps } from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  BgColorsOutlined,
  FontSizeOutlined,
  AppleOutlined,
  UploadOutlined,
  CustomerServiceOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import type { SleepTimerState } from '../types';

const { Text } = Typography;

interface NavbarProps {
  currentBookTitle?: string;
  onBackToShelf?: () => void;
  onOpenTimerModal: () => void;
  onOpenIOSGuide: () => void;
  onOpenReaderSettings?: () => void;
  onOpenVoiceModal?: () => void;
  onOpenUpload?: () => void;
  sleepTimer: SleepTimerState;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentBookTitle,
  onBackToShelf,
  onOpenTimerModal,
  onOpenIOSGuide,
  onOpenReaderSettings,
  onOpenVoiceModal,
  onOpenUpload,
  sleepTimer,
}) => {
  const { setTheme } = useSettingsStore();

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

  const formatTimerLabel = () => {
    if (!sleepTimer.isActive) return '';
    if (sleepTimer.targetMode === 'chapter') return 'Hết chương';
    const m = Math.floor(sleepTimer.remainingSeconds / 60);
    const s = sleepTimer.remainingSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const menuItems: MenuProps['items'] = [
    ...(onOpenVoiceModal
      ? [{ key: 'voice', icon: <CustomerServiceOutlined />, label: 'Giọng đọc', onClick: onOpenVoiceModal }]
      : []),
    ...(onOpenReaderSettings
      ? [{ key: 'display', icon: <FontSizeOutlined />, label: 'Hiển thị (Aa)', onClick: onOpenReaderSettings }]
      : []),
    {
      key: 'timer',
      icon: <ClockCircleOutlined />,
      label: sleepTimer.isActive ? `Hẹn giờ ngủ · ${formatTimerLabel()}` : 'Hẹn giờ ngủ',
      onClick: onOpenTimerModal,
    },
    ...(onOpenReaderSettings
      ? []
      : [
          { type: 'divider' as const },
          {
            key: 'theme',
            icon: <BgColorsOutlined />,
            label: 'Giao diện',
            children: themeMenuItems,
          },
        ]),
    { type: 'divider' as const },
    { key: 'ios', icon: <AppleOutlined />, label: 'Mẹo tối ưu iOS Safari', onClick: onOpenIOSGuide },
  ];

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        paddingTop: 'var(--sat, 0px)',
        height: 'calc(56px + var(--sat, 0px))',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Brand or Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {currentBookTitle ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBackToShelf}
            style={{ padding: '4px 8px', flexShrink: 0 }}
          >
            Thư viện
          </Button>
        ) : (
          <Space align="center" size={6} style={{ flexShrink: 0 }}>
            <img src="/favicon.svg" alt="" width={28} height={28} style={{ borderRadius: 8, display: 'block' }} />
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
              flex: 1,
              minWidth: 0,
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

        {sleepTimer.isActive && (
          <Button
            type="primary"
            size="small"
            icon={<ClockCircleOutlined />}
            onClick={onOpenTimerModal}
            style={{ borderRadius: 14, fontSize: 12 }}
          >
            {formatTimerLabel()}
          </Button>
        )}

        <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
          <Badge dot={sleepTimer.isActive} color="#52c41a" offset={[-6, 6]}>
            <Button type="text" icon={<MenuOutlined />} aria-label="Menu" style={{ width: 40, height: 40, fontSize: 18 }} />
          </Badge>
        </Dropdown>
      </Space>
    </header>
  );
};
