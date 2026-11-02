import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, List, Popconfirm, Progress, Space, Tag, Typography, message } from 'antd';
import { CaretRightOutlined, DownloadOutlined } from '@ant-design/icons';
import {
  VTTS_TOTAL_BYTES,
  VTTS_VOICES,
  deleteModel,
  isModelDownloaded,
  loadModel,
  type VttsVoiceItem,
} from '../services/vttsService';

const { Text } = Typography;

interface Props {
  selectedVoiceURI: string;
  onSelect: (voice: VttsVoiceItem) => void;
  onPreview: (voice: VttsVoiceItem) => void;
}

/** V-TTS tab: download the ~175 MB model once, then voices run fully inside the browser. */
export const VttsPanel: React.FC<Props> = ({ selectedVoiceURI, onSelect, onPreview }) => {
  const [downloaded, setDownloaded] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const refresh = useCallback(() => {
    isModelDownloaded().then(setDownloaded);
  }, []);
  useEffect(refresh, [refresh]);

  const download = async () => {
    setProgress(0);
    try {
      await loadModel((p) => setProgress(p));
      message.success('Đã tải xong mô hình V-TTS');
    } catch (err) {
      message.error(`Tải mô hình thất bại: ${(err as Error).message}`);
    } finally {
      setProgress(null);
      refresh();
    }
  };

  const remove = async () => {
    await deleteModel();
    message.success('Đã xoá mô hình V-TTS');
    refresh();
  };

  const threaded = typeof self !== 'undefined' && self.crossOriginIsolated;
  const sizeMb = Math.round(VTTS_TOTAL_BYTES / 1_000_000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '10px 12px', background: 'var(--surface-alt)', borderRadius: 8 }}>
        <Text strong style={{ display: 'block' }}>
          V-TTS · chạy ngay trên máy bạn
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          5 giọng Bắc/Nam, không cần server hay mạng sau khi tải. Mô hình khoảng {sizeMb} MB, chỉ tải một lần và được
          lưu trong trình duyệt. Chỉ dùng cho mục đích cá nhân, phi thương mại.
        </Text>
        <div style={{ marginTop: 6 }}>
          <Tag color={threaded ? 'green' : 'orange'}>{threaded ? 'Đa luồng: bật (nhanh)' : 'Đa luồng: tắt (chậm hơn)'}</Tag>
        </div>
      </div>

      {!threaded && (
        <Alert
          type="warning"
          showIcon
          message="Đang chạy một luồng nên có thể chậm hơn tốc độ đọc. Hãy mở trang qua HTTPS (bản web trên GitHub) và tải lại một lần để bật đa luồng."
        />
      )}

      {downloaded === false && progress === null && (
        <Button type="primary" icon={<DownloadOutlined />} onClick={download} block size="large">
          Tải mô hình (~{sizeMb} MB)
        </Button>
      )}
      {progress !== null && <Progress percent={progress} status="active" />}
      {downloaded && progress === null && (
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Text type="success">Đã tải mô hình</Text>
          <Popconfirm title="Xoá mô hình V-TTS khỏi trình duyệt?" okText="Xoá" cancelText="Huỷ" onConfirm={remove}>
            <Button size="small" danger>
              Xoá mô hình
            </Button>
          </Popconfirm>
        </Space>
      )}

      <List
        dataSource={VTTS_VOICES}
        renderItem={(voice) => {
          const isSelected = selectedVoiceURI === voice.id;
          return (
            <List.Item
              key={voice.id}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 8,
                background: isSelected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                opacity: downloaded ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <Text strong>{voice.name}</Text>
                  <Tag color={voice.color} style={{ marginLeft: 6 }}>
                    {voice.region}
                  </Tag>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    {voice.description}
                  </Text>
                </div>
                <Space size={4}>
                  <Button size="small" icon={<CaretRightOutlined />} disabled={!downloaded} onClick={() => onPreview(voice)}>
                    Thử
                  </Button>
                  <Button size="small" type={isSelected ? 'primary' : 'default'} disabled={!downloaded} onClick={() => onSelect(voice)}>
                    Dùng
                  </Button>
                </Space>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
};
