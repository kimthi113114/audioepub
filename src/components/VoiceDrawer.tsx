import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Tabs,
  List,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  Progress,
  Alert,
  Tooltip,
  Card,
  Segmented,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckOutlined,
  CustomerServiceFilled,
  CloudDownloadOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  WomanOutlined,
  ManOutlined,
  AppleOutlined,
  WindowsOutlined,
  AndroidOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatVoiceInfo } from '../utils/voiceHelper';
import {
  PIPER_VOICES,
  downloadPiperVitsModel,
  deletePiperVitsModelCache,
  PIPER_MODEL_SIZE_MB,
} from '../utils/piperVoices';
import type { PiperVoiceItem, ModelDownloadProgress } from '../types';

const { Text } = Typography;

interface VoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  onPreviewVoice: (voiceURI: string, sampleText?: string) => void;
}

export const VoiceDrawer: React.FC<VoiceDrawerProps> = ({
  open,
  onClose,
  voices,
  vietnameseVoices,
  onPreviewVoice,
}) => {
  const {
    selectedVoiceURI,
    setSelectedVoiceURI,
    setNeuralSpeakerId,
    setTtsEngine,
    neuralModelDownloaded,
    setNeuralModelDownloaded,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<string>('system');
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  // Piper Search & Filter states
  const [piperSearch, setPiperSearch] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // System voices search state
  const [systemSearch, setSystemSearch] = useState<string>('');

  // Model download progress state
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Filter Piper Voices
  const filteredPiperVoices = useMemo(() => {
    return PIPER_VOICES.filter((voice) => {
      // Gender filter
      if (genderFilter !== 'all' && voice.gender !== genderFilter) return false;
      // Region filter
      if (regionFilter !== 'all' && voice.region !== regionFilter) return false;
      // Search keyword
      if (piperSearch.trim()) {
        const q = piperSearch.toLowerCase().trim();
        const matchName = voice.name.toLowerCase().includes(q);
        const matchCode = voice.code.toLowerCase().includes(q);
        const matchRegion = voice.region.toLowerCase().includes(q);
        const matchDesc = voice.description.toLowerCase().includes(q);
        return matchName || matchCode || matchRegion || matchDesc;
      }
      return true;
    });
  }, [piperSearch, genderFilter, regionFilter]);

  // Filter Web Speech voices
  const filteredSystemVNVoices = useMemo(() => {
    if (!systemSearch.trim()) return vietnameseVoices;
    const q = systemSearch.toLowerCase().trim();
    return vietnameseVoices.filter(
      (v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)
    );
  }, [vietnameseVoices, systemSearch]);

  const otherVoices = useMemo(() => {
    const list = voices.filter((v) => !vietnameseVoices.includes(v));
    if (!systemSearch.trim()) return list.slice(0, 20);
    const q = systemSearch.toLowerCase().trim();
    return list.filter((v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)).slice(0, 20);
  }, [voices, vietnameseVoices, systemSearch]);

  // Handle Model Download
  const handleDownloadModel = async () => {
    setIsDownloading(true);
    setDownloadProgress({
      modelId: 'vi_VN-vivos-x_low',
      percent: 0,
      loadedBytes: 0,
      totalBytes: 27789413,
      status: 'downloading',
    });

    try {
      const success = await downloadPiperVitsModel((p) => {
        setDownloadProgress(p);
      });
      if (success) {
        setNeuralModelDownloaded(true);
        message.success('Đã tải và lưu trữ mô hình giọng AI vào bộ nhớ máy thành công!');
      }
    } catch (err) {
      console.error('Download error:', err);
      message.error('Không thể hoàn tất tải mô hình, vui lòng thử lại');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDeleteModelCache = async () => {
    await deletePiperVitsModelCache();
    setNeuralModelDownloaded(false);
    message.info('Đã giải phóng bộ nhớ đệm mô hình AI');
  };

  // Handle Preview Audio
  const handlePreviewPiperVoice = (voice: PiperVoiceItem) => {
    setPreviewingURI(voice.id);
    const sample = `Xin chào! Tôi là ${voice.name}, giọng đọc AI tự nhiên chất lượng cao trên AudioEpub.`;
    onPreviewVoice(voice.id, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.id ? null : current));
    }, 4500);
  };

  const handlePreviewSystemVoice = (voice: SpeechSynthesisVoice) => {
    setPreviewingURI(voice.voiceURI);
    const info = formatVoiceInfo(voice);
    const sample = `Xin chào! Tôi là ${info.displayName}, giọng đọc trình duyệt trên AudioEpub.`;
    onPreviewVoice(voice.voiceURI, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.voiceURI ? null : current));
    }, 4000);
  };

  // Select Piper Voice
  const handleSelectPiperVoice = (voice: PiperVoiceItem) => {
    setSelectedVoiceURI(voice.id);
    setNeuralSpeakerId(voice.speakerId);
    setTtsEngine('neural_piper');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  // Select System Voice
  const handleSelectSystemVoice = (voice: SpeechSynthesisVoice) => {
    setSelectedVoiceURI(voice.voiceURI);
    setTtsEngine('webspeech');
    const info = formatVoiceInfo(voice);
    message.success(`Đã chọn: ${info.displayName}`);
    onClose();
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space align="center" size={8}>
            <CustomerServiceFilled style={{ color: '#1677ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Chọn Giọng Đọc Sách</span>
          </Space>
        </div>
      }
      placement="bottom"
      height="65vh"
      open={open}
      onClose={onClose}
      destroyOnHidden
      styles={{
        wrapper: {
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          overflow: 'hidden',
        },
        content: {
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          overflow: 'hidden',
        },
        body: {
          padding: '8px 14px',
          paddingBottom: 'calc(var(--sab, 0px) + 16px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      }}
    >
      {/* Sleek mobile grab handle indicator */}
      <div
        style={{
          width: 38,
          height: 4,
          background: '#cbd5e1',
          borderRadius: 2,
          margin: '0 auto 8px',
        }}
      />

      <Tabs
        activeKey={activeTab}
        defaultActiveKey="system"
        onChange={setActiveTab}
        centered
        items={[
          {
            key: 'system',
            label: (
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                🌟 Giọng Tự Nhiên Studio ({vietnameseVoices.length})
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input.Search
                  placeholder="Tìm giọng hệ thống / trình duyệt..."
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  allowClear
                  size="middle"
                  style={{ borderRadius: 8 }}
                />

                {vietnameseVoices.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Chưa phát hiện giọng Tiếng Việt của hệ thống"
                    description={
                      <div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 4 }}>
                        <p style={{ margin: '3px 0' }}>
                          <AppleOutlined /> <strong>iOS Safari:</strong> Vào <em>Cài đặt</em> &gt; <em>Trợ năng</em> &gt; <em>Đọc nội dung</em> &gt; <em>Giọng nói</em> &gt; <em>Tiếng Việt</em> &gt; Tải giọng <strong>Linh</strong> hoặc <strong>An</strong>.
                        </p>
                        <p style={{ margin: '3px 0' }}>
                          <WindowsOutlined /> <strong>Windows:</strong> Dùng Microsoft Edge để có sẵn giọng AI <strong>Hoài My</strong> &amp; <strong>Nam Minh</strong>.
                        </p>
                        <p style={{ margin: '3px 0' }}>
                          <AndroidOutlined /> <strong>Android:</strong> Cài đặt <em>Dịch vụ giọng nói của Google</em> và tải gói Tiếng Việt.
                        </p>
                      </div>
                    }
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      🇻🇳 Giọng Đọc Tiếng Việt ({filteredSystemVNVoices.length})
                    </div>
                    <List
                      dataSource={filteredSystemVNVoices}
                      renderItem={(voice) => {
                        const info = formatVoiceInfo(voice);
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;

                        return (
                          <List.Item
                            style={{
                              padding: '12px 10px',
                              borderRadius: 10,
                              marginBottom: 8,
                              border: isSelected ? '1.5px solid #1677ff' : '1px solid rgba(0,0,0,0.06)',
                              background: isSelected ? 'rgba(22, 119, 255, 0.05)' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              minHeight: 56, // Touch friendly >= 48px
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text strong style={{ fontSize: 14 }}>
                                  {info.displayName}
                                </Text>
                                <Tag color={info.color} style={{ margin: 0, fontSize: 10 }}>
                                  {info.badge}
                                </Tag>
                                {isSelected && (
                                  <Tag color="blue" icon={<CheckOutlined />} style={{ margin: 0, fontSize: 10 }}>
                                    Đang dùng
                                  </Tag>
                                )}
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                                {voice.voiceURI}
                              </Text>
                            </div>

                            <Space size={6} style={{ flexShrink: 0 }}>
                              <Button
                                size="middle"
                                icon={<PlayCircleOutlined />}
                                loading={isPreviewing}
                                onClick={() => handlePreviewSystemVoice(voice)}
                                style={{
                                  minHeight: 44,
                                  minWidth: 44,
                                  borderRadius: 8,
                                }}
                              >
                                Thử
                              </Button>

                              <Button
                                type={isSelected ? 'default' : 'primary'}
                                size="middle"
                                disabled={isSelected}
                                onClick={() => handleSelectSystemVoice(voice)}
                                style={{
                                  minHeight: 44,
                                  borderRadius: 8,
                                  fontWeight: 500,
                                }}
                              >
                                {isSelected ? 'Đang dùng' : 'Chọn'}
                              </Button>
                            </Space>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}

                {/* International Voices Section */}
                {otherVoices.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      🌍 Giọng Quốc Tế Khác ({otherVoices.length})
                    </div>
                    <List
                      size="small"
                      dataSource={otherVoices}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        return (
                          <List.Item
                            actions={[
                              <Button
                                key="preview"
                                size="small"
                                icon={<PlayCircleOutlined />}
                                onClick={() => handlePreviewSystemVoice(voice)}
                              >
                                Thử
                              </Button>,
                              <Button
                                key="select"
                                size="small"
                                type={isSelected ? 'default' : 'primary'}
                                disabled={isSelected}
                                onClick={() => handleSelectSystemVoice(voice)}
                              >
                                {isSelected ? 'Đang dùng' : 'Chọn'}
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              title={<span style={{ fontSize: 13 }}>{voice.name}</span>}
                              description={<span style={{ fontSize: 11 }}>{voice.lang}</span>}
                            />
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'neural',
            label: (
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                💾 Giọng Offline Nén ({PIPER_VOICES.length})
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Model Download & Offline Cache Status Card */}
                <Card
                  size="small"
                  style={{
                    borderRadius: 12,
                    background: neuralModelDownloaded
                      ? 'linear-gradient(135deg, #f0fdf4 0%, #e6f9ed 100%)'
                      : 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                    border: neuralModelDownloaded ? '1px solid #86efac' : '1px solid #bfdbfe',
                  }}
                >
                  {neuralModelDownloaded ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <Space size={8}>
                        <CheckCircleFilled style={{ color: '#22c55e', fontSize: 18 }} />
                        <div>
                          <Text strong style={{ fontSize: 13, color: '#15803d' }}>
                            Mô hình AI đã sẵn sàng (Offline {PIPER_MODEL_SIZE_MB} MB)
                          </Text>
                          <div style={{ fontSize: 11, color: '#4b5563' }}>
                            Chạy ngầm 100% khi tắt màn hình khóa iOS Safari.
                          </div>
                        </div>
                      </Space>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleDeleteModelCache}
                        style={{ fontSize: 11 }}
                      >
                        Xóa cache
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <Text strong style={{ fontSize: 13, color: '#1e3a8a' }}>
                            Mô hình Piper VITS Offline ({PIPER_MODEL_SIZE_MB} MB)
                          </Text>
                          <div style={{ fontSize: 11, color: '#475569' }}>
                            65 giọng đọc AI tự nhiên Nam/Nữ Bắc-Trung-Nam.
                          </div>
                        </div>
                        <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                          Khuyên dùng
                        </Tag>
                      </div>

                      {isDownloading && downloadProgress ? (
                        <div style={{ marginTop: 4 }}>
                          <Progress
                            percent={downloadProgress.percent}
                            status="active"
                            strokeColor={{ '0%': '#3b82f6', '100%': '#10b981' }}
                            size="small"
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            <span>
                              {((downloadProgress.loadedBytes || 0) / (1024 * 1024)).toFixed(1)} / {PIPER_MODEL_SIZE_MB} MB
                            </span>
                            <span>{downloadProgress.percent}%</span>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="primary"
                          icon={<CloudDownloadOutlined style={{ fontSize: 16 }} />}
                          loading={isDownloading}
                          onClick={handleDownloadModel}
                          style={{
                            height: 44,
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            marginTop: 4,
                            boxShadow: '0 2px 8px rgba(22, 119, 255, 0.25)',
                          }}
                          block
                        >
                          Tải Mô Hình AI Tiếng Việt ({PIPER_MODEL_SIZE_MB} MB)
                        </Button>
                      )}
                    </div>
                  )}
                </Card>

                {/* Filter Controls: Search & Segmented */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Input.Search
                    placeholder="Tìm giọng AI (tên, vùng miền, nam/nữ)..."
                    value={piperSearch}
                    onChange={(e) => setPiperSearch(e.target.value)}
                    allowClear
                    size="middle"
                    style={{ borderRadius: 8 }}
                  />

                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                    <Segmented
                      size="small"
                      value={genderFilter}
                      onChange={(val) => setGenderFilter(val as string)}
                      options={[
                        { label: 'Tất cả', value: 'all' },
                        { label: 'Nữ (33)', value: 'female' },
                        { label: 'Nam (32)', value: 'male' },
                      ]}
                    />

                    <Segmented
                      size="small"
                      value={regionFilter}
                      onChange={(val) => setRegionFilter(val as string)}
                      options={[
                        { label: 'Tất cả miền', value: 'all' },
                        { label: 'Miền Bắc', value: 'Bắc' },
                        { label: 'Miền Trung', value: 'Trung' },
                        { label: 'Miền Nam', value: 'Nam' },
                      ]}
                    />
                  </div>
                </div>

                {/* List of 65 Piper Voices */}
                <List
                  dataSource={filteredPiperVoices}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        style={{
                          padding: '12px 10px',
                          borderRadius: 10,
                          marginBottom: 8,
                          border: isSelected ? '1.5px solid #1677ff' : '1px solid rgba(0,0,0,0.06)',
                          background: isSelected ? 'rgba(22, 119, 255, 0.05)' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          minHeight: 56, // Touch friendly >= 48px
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {voice.gender === 'female' ? (
                              <WomanOutlined style={{ color: '#e11d48', fontSize: 14 }} />
                            ) : (
                              <ManOutlined style={{ color: '#2563eb', fontSize: 14 }} />
                            )}
                            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                              {voice.name}
                            </Text>
                            <Tag color={voice.color} style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>
                              {voice.badge}
                            </Tag>
                            <Tag style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '18px', background: '#f1f5f9' }}>
                              {voice.code}
                            </Tag>
                            {isSelected && (
                              <Tag color="blue" icon={<CheckOutlined />} style={{ margin: 0, fontSize: 10 }}>
                                Đang dùng
                              </Tag>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {voice.description}
                          </div>
                        </div>

                        <Space size={6} style={{ flexShrink: 0 }}>
                          <Tooltip title="Nghe thử giọng mẫu">
                            <Button
                              size="middle"
                              icon={isPreviewing ? <SoundOutlined spin /> : <PlayCircleOutlined />}
                              loading={isPreviewing}
                              onClick={() => handlePreviewPiperVoice(voice)}
                              style={{
                                minHeight: 44, // Touch target >= 44-48px
                                minWidth: 44,
                                padding: '0 10px',
                                borderRadius: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              Thử
                            </Button>
                          </Tooltip>

                          <Button
                            type={isSelected ? 'default' : 'primary'}
                            size="middle"
                            disabled={isSelected}
                            onClick={() => handleSelectPiperVoice(voice)}
                            style={{
                              minHeight: 44, // Touch target >= 44-48px
                              borderRadius: 8,
                              fontWeight: 500,
                            }}
                          >
                            {isSelected ? 'Đang dùng' : 'Chọn'}
                          </Button>
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
};
