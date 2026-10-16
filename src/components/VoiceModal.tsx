import React, { useState, useMemo } from 'react';
import {
  Modal,
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
  Collapse,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckOutlined,
  CustomerServiceOutlined,
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

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  onPreviewVoice: (voiceURI: string, sampleText?: string) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
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
    setEngineMode,
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
      if (genderFilter !== 'all' && voice.gender !== genderFilter) return false;
      if (regionFilter !== 'all' && voice.region !== regionFilter) return false;
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

  // Filter Web Speech voices (Studio/Natural voices always placed at top)
  const filteredSystemVNVoices = useMemo(() => {
    let list = vietnameseVoices;
    if (systemSearch.trim()) {
      const q = systemSearch.toLowerCase().trim();
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aIsStudio = /online|natural|neural|hoài|hoaimy|nam|namminh|linh|an/i.test(a.name) ? 1 : 0;
      const bIsStudio = /online|natural|neural|hoài|hoaimy|nam|namminh|linh|an/i.test(b.name) ? 1 : 0;
      return bIsStudio - aIsStudio;
    });
  }, [vietnameseVoices, systemSearch]);

  const otherVoices = useMemo(() => {
    const list = voices.filter((v) => !vietnameseVoices.includes(v));
    if (!systemSearch.trim()) return list;
    const q = systemSearch.toLowerCase().trim();
    return list.filter((v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q));
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
    setEngineMode('neural');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  // Select System Voice
  const handleSelectSystemVoice = (voice: SpeechSynthesisVoice) => {
    setSelectedVoiceURI(voice.voiceURI);
    setTtsEngine('webspeech');
    setEngineMode('system');
    const info = formatVoiceInfo(voice);
    message.success(`Đã chọn: ${info.displayName}`);
    onClose();
  };

  return (
    <Modal
      title={
        <Space align="center" size={8}>
          <CustomerServiceOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <span>Cài Đặt &amp; Chọn Giọng Đọc Sách Nói (Voice Settings)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={580}
      destroyOnHidden
      centered
      styles={{
        body: {
          maxHeight: '75vh',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
    >
      <Tabs
        activeKey={activeTab}
        defaultActiveKey="system"
        onChange={setActiveTab}
        items={[
          {
            key: 'system',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                🌟 Giọng Tự Nhiên Studio ({vietnameseVoices.length})
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                <Alert
                  type="success"
                  showIcon
                  message="Khuyên dùng cho Sách Nói (Đọc có hồn như người thật)"
                  description="Các giọng đọc Neural thế hệ mới (Microsoft Hoài My, Nam Minh trên Edge/Windows hoặc Siri Linh, An trên iOS Safari). Phát âm rõ ràng, ngắt nghỉ cảm xúc, chuẩn tiếng Việt 100% và không cần tải thêm dữ liệu (0 MB)."
                  style={{ borderRadius: 8 }}
                />
                <Input.Search
                  placeholder="Tìm kiếm giọng đọc tự nhiên..."
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
                    message="Chưa phát hiện giọng đọc Tiếng Việt của hệ thống"
                    description={
                      <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
                        <p style={{ margin: '4px 0' }}>
                          <AppleOutlined /> <strong>Trên iOS (iPhone/iPad):</strong> Vào <em>Cài đặt</em> &gt; <em>Trợ năng</em> &gt; <em>Đọc nội dung</em> &gt; <em>Giọng nói</em> &gt; <em>Tiếng Việt</em> &gt; Tải giọng <strong>Linh</strong> hoặc <strong>An</strong>.
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <WindowsOutlined /> <strong>Trên Windows:</strong> Sử dụng trình duyệt <strong>Microsoft Edge</strong> để có sẵn giọng AI <strong>Hoài My</strong> &amp; <strong>Nam Minh</strong> cực hay.
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <AndroidOutlined /> <strong>Trên Android:</strong> Cài đặt ứng dụng <em>Dịch vụ giọng nói của Google</em> và tải gói giọng nói Tiếng Việt.
                        </p>
                      </div>
                    }
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                      🇻🇳 Giọng Đọc Tiếng Việt ({filteredSystemVNVoices.length})
                    </div>
                    <List
                      dataSource={filteredSystemVNVoices}
                      renderItem={(voice) => {
                        const info = formatVoiceInfo(voice);
                        const isSelected = voice.voiceURI === selectedVoiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;

                        return (
                          <List.Item
                            style={{
                              padding: '10px 12px',
                              borderRadius: 8,
                              marginBottom: 6,
                              border: isSelected ? '1.5px solid #1677ff' : '1px solid rgba(0,0,0,0.08)',
                              background: isSelected ? 'rgba(22, 119, 255, 0.04)' : '#fafafa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.2s',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text strong style={{ fontSize: 14 }}>
                                  {info.displayName}
                                </Text>
                                <Tag color={info.color} style={{ margin: 0, fontSize: 11 }}>
                                  {info.badge}
                                </Tag>
                                {isSelected && (
                                  <Tag color="blue" icon={<CheckOutlined />} style={{ margin: 0, fontSize: 11 }}>
                                    Đang dùng
                                  </Tag>
                                )}
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                                {voice.voiceURI}
                              </Text>
                            </div>

                            <Space size={6}>
                              <Tooltip title="Nghe thử câu mẫu">
                                <Button
                                  size="small"
                                  icon={<PlayCircleOutlined />}
                                  loading={isPreviewing}
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                >
                                  Nghe thử
                                </Button>
                              </Tooltip>

                              <Button
                                type={isSelected ? 'default' : 'primary'}
                                size="small"
                                disabled={isSelected}
                                onClick={() => handleSelectSystemVoice(voice)}
                              >
                                {isSelected ? 'Đã chọn' : 'Chọn'}
                              </Button>
                            </Space>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}

                {/* International Voices (Collapsible) */}
                {otherVoices.length > 0 && (
                  <Collapse
                    ghost
                    items={[
                      {
                        key: 'other',
                        label: (
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            🌍 Các giọng đọc quốc tế khác ({otherVoices.length} giọng)
                          </Text>
                        ),
                        children: (
                          <List
                            size="small"
                            dataSource={otherVoices.slice(0, 20)}
                            renderItem={(voice) => {
                              const isSelected = voice.voiceURI === selectedVoiceURI;
                              return (
                                <List.Item
                                  actions={[
                                    <Button
                                      key="preview"
                                      type="text"
                                      size="small"
                                      icon={<PlayCircleOutlined />}
                                      onClick={() => handlePreviewSystemVoice(voice)}
                                    >
                                      Thử
                                    </Button>,
                                    <Button
                                      key="select"
                                      size="small"
                                      type={isSelected ? 'default' : 'link'}
                                      disabled={isSelected}
                                      onClick={() => handleSelectSystemVoice(voice)}
                                    >
                                      {isSelected ? 'Đã chọn' : 'Chọn'}
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
                        ),
                      },
                    ]}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'neural',
            label: (
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                💾 Giọng Offline Nén (Piper VITS 65 giọng)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Mô hình nén cục bộ (~27.8 MB) - Chỉ dùng khi không có Internet"
                  description="Mô hình nén siêu nhỏ x_low chạy hoàn toàn offline khi đi máy bay. Do nén để giảm dung lượng nên âm sắc sẽ mộc và máy móc hơn so với giọng Studio tự nhiên ở Tab Giọng Tự Nhiên."
                  style={{ borderRadius: 8 }}
                />
                {/* Model Download & Offline Cache Status Card */}
                <Card
                  size="small"
                  style={{
                    borderRadius: 10,
                    background: neuralModelDownloaded
                      ? 'linear-gradient(135deg, #f0fdf4 0%, #e6f9ed 100%)'
                      : 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                    border: neuralModelDownloaded ? '1px solid #86efac' : '1px solid #bfdbfe',
                  }}
                >
                  {neuralModelDownloaded ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <Space size={8}>
                        <CheckCircleFilled style={{ color: '#22c55e', fontSize: 20 }} />
                        <div>
                          <Text strong style={{ fontSize: 13, color: '#15803d' }}>
                            Mô hình AI đã sẵn sàng (Offline {PIPER_MODEL_SIZE_MB} MB)
                          </Text>
                          <div style={{ fontSize: 12, color: '#4b5563' }}>
                            65 giọng đọc chất lượng cao. Chạy ngầm 100% khi tắt màn hình khóa iOS Safari.
                          </div>
                        </div>
                      </Space>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleDeleteModelCache}
                        style={{ fontSize: 12 }}
                      >
                        Xóa cache
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <Text strong style={{ fontSize: 13, color: '#1e3a8a' }}>
                            Mô hình Neural AI Piper VITS ({PIPER_MODEL_SIZE_MB} MB)
                          </Text>
                          <div style={{ fontSize: 12, color: '#475569' }}>
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
                            height: 40,
                            borderRadius: 8,
                            fontSize: 13,
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

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Segmented
                      size="small"
                      value={genderFilter}
                      onChange={(val) => setGenderFilter(val as string)}
                      options={[
                        { label: 'Tất cả giới tính', value: 'all' },
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
                  pagination={{
                    pageSize: 8,
                    size: 'small',
                    showSizeChanger: false,
                  }}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          marginBottom: 6,
                          border: isSelected ? '1.5px solid #1677ff' : '1px solid rgba(0,0,0,0.06)',
                          background: isSelected ? 'rgba(22, 119, 255, 0.04)' : '#fafafa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {voice.gender === 'female' ? (
                              <WomanOutlined style={{ color: '#e11d48', fontSize: 14 }} />
                            ) : (
                              <ManOutlined style={{ color: '#2563eb', fontSize: 14 }} />
                            )}
                            <Text strong style={{ fontSize: 14 }}>
                              {voice.name}
                            </Text>
                            <Tag color={voice.color} style={{ margin: 0, fontSize: 11 }}>
                              {voice.badge}
                            </Tag>
                            <Tag style={{ margin: 0, fontSize: 11, background: '#f1f5f9' }}>
                              {voice.code}
                            </Tag>
                            {isSelected && (
                              <Tag color="blue" icon={<CheckOutlined />} style={{ margin: 0, fontSize: 11 }}>
                                Đang dùng
                              </Tag>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
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

                        <Space size={6}>
                          <Tooltip title="Nghe thử câu mẫu">
                            <Button
                              size="small"
                              icon={isPreviewing ? <SoundOutlined spin /> : <PlayCircleOutlined />}
                              loading={isPreviewing}
                              onClick={() => handlePreviewPiperVoice(voice)}
                            >
                              Thử
                            </Button>
                          </Tooltip>

                          <Button
                            type={isSelected ? 'default' : 'primary'}
                            size="small"
                            disabled={isSelected}
                            onClick={() => handleSelectPiperVoice(voice)}
                          >
                            {isSelected ? 'Đã chọn' : 'Chọn'}
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
    </Modal>
  );
};
