import React, { useState } from 'react';
import { Modal, Button, Space, Typography, InputNumber, Switch } from 'antd';
import { ClockCircleOutlined, PoweroffOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { SleepTimerState } from '../types';

const { Text, Title } = Typography;

interface SleepTimerModalProps {
  open: boolean;
  onClose: () => void;
  sleepTimer: SleepTimerState;
  onStartTimer: (minutes: number | 'chapter') => void;
  onCancelTimer: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  open,
  onClose,
  sleepTimer,
  onStartTimer,
  onCancelTimer,
}) => {
  const [customMinutes, setCustomMinutes] = useState<number>(20);
  const presets = [15, 30, 45, 60];

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined style={{ color: 'var(--primary)' }} />
          <span>Hẹn giờ tắt (Sleep Timer)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
    >
      <div style={{ padding: '12px 0' }}>
        {sleepTimer.isActive ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              background: 'var(--primary-soft)',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 32, color: '#16a34a' }} />
            <Title level={3} style={{ margin: '8px 0 4px', color: '#15803d' }}>
              {sleepTimer.targetMode === 'chapter'
                ? 'Hết chương hiện tại'
                : formatRemaining(sleepTimer.remainingSeconds)}
            </Title>
            <Text type="secondary">
              {sleepTimer.targetMode === 'chapter'
                ? 'Âm thanh sẽ dừng ngay khi đọc xong chương này'
                : 'Đang đếm ngược để tự động dừng phát âm thanh'}
            </Text>
            <div style={{ marginTop: 16 }}>
              <Button danger icon={<PoweroffOutlined />} onClick={onCancelTimer}>
                Hủy hẹn giờ
              </Button>
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Chọn thời gian để ứng dụng tự động tắt âm thanh khi bạn chìm vào giấc ngủ.
          </Text>
        )}

        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Gợi ý nhanh:
          </Text>
          <Space wrap size={[8, 8]}>
            {presets.map((mins) => (
              <Button
                key={mins}
                type="default"
                onClick={() => {
                  onStartTimer(mins);
                  onClose();
                }}
              >
                {mins} phút
              </Button>
            ))}
            <Button
              type="primary"
              ghost
              onClick={() => {
                onStartTimer('chapter');
                onClose();
              }}
            >
              Hết chương hiện tại
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Hoặc tùy chỉnh số phút:
          </Text>
          <Space>
            <InputNumber
              min={1}
              max={240}
              value={customMinutes}
              onChange={(val) => setCustomMinutes(val || 15)}
              addonAfter="phút"
            />
            <Button
              type="primary"
              onClick={() => {
                onStartTimer(customMinutes);
                onClose();
              }}
            >
              Bắt đầu
            </Button>
          </Space>
        </div>

        <div
          style={{
            padding: '12px 16px',
            background: 'var(--surface-alt)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Text strong>Giảm dần âm lượng (Fade-out)</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Âm lượng sẽ nhỏ dần trong 30 giây cuối để không làm bạn giật mình.
            </Text>
          </div>
          <Switch defaultChecked disabled />
        </div>
      </div>
    </Modal>
  );
};
