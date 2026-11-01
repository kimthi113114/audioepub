import React from 'react';
import { Modal, Typography, Steps, Alert, Tag } from 'antd';
import { AppleOutlined, SoundOutlined, MobileOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

interface IOSGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const IOSGuideModal: React.FC<IOSGuideModalProps> = ({ open, onClose }) => {
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AppleOutlined style={{ fontSize: 22, color: '#000' }} />
          <span>Mẹo tối ưu nghe trên iOS Safari (iPhone / iPad)</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={560}
    >
      <div style={{ padding: '8px 0' }}>
        <Alert
          title="Trải nghiệm giọng đọc chất lượng cao trên iPhone"
          description="iOS có sẵn giọng đọc tiếng Việt rất mượt (giọng Linh). Để đạt chất lượng tự nhiên nhất, bạn nên tải bản Enhanced/Nâng cao theo các bước dưới đây."
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Steps
          orientation="vertical"
          size="small"
          current={-1}
          items={[
            {
              title: <Text strong>1. Bật Giọng Đọc Nâng Cao (Enhanced Voice)</Text>,
              description: (
                <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
                  Mở <b>Cài đặt (Settings)</b> trên iPhone &gt; <b>Trợ năng (Accessibility)</b> &gt;{' '}
                  <b>Nội dung được đọc (Spoken Content)</b> &gt; <b>Giọng nói (Voices)</b> &gt;{' '}
                  <b>Tiếng Việt</b> &gt; Chọn <b>Linh (Nâng cao / Tự nhiên)</b> và bấm tải về.
                </Paragraph>
              ),
              icon: <SoundOutlined style={{ color: 'var(--primary)' }} />,
            },
            {
              title: <Text strong>2. Thêm vào Màn hình chính (PWA Fullscreen)</Text>,
              description: (
                <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
                  Nhấn nút <b>Chia sẻ (Share icon <Tag color="blue">↑</Tag>)</b> ở thanh dưới của Safari &gt; Chọn{' '}
                  <b>"Thêm vào MH chính" (Add to Home Screen)</b>. Web app sẽ mở toàn màn hình, không bị che bởi thanh địa chỉ Safari.
                </Paragraph>
              ),
              icon: <MobileOutlined style={{ color: '#52c41a' }} />,
            },
            {
              title: <Text strong>3. Nghe khi tắt màn hình</Text>,
              description: (
                <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
                  Ứng dụng đã tích hợp sẵn audio keep-alive và MediaSession. Bạn có thể điều khiển Play/Pause, chuyển câu trực tiếp từ Màn hình khóa (Lockscreen) hoặc qua tai nghe AirPods!
                </Paragraph>
              ),
              icon: <CheckCircleOutlined style={{ color: '#faad14' }} />,
            },
          ]}
        />
      </div>
    </Modal>
  );
};
