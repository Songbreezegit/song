import type { SupportedLanguage } from '../i18n/types';

export interface LocalizedProjectFields {
  title?: string;
  subtitle?: string;
  tagline?: string;
  categoryLabel?: string;
  description?: string;
  overview?: string;
  features?: string[];
  developmentNotes?: string;
  challengesSolutions?: {
    challenge: string;
    solution: string;
  }[];
}

export const PROJECT_TRANSLATIONS: Record<string, Partial<Record<SupportedLanguage, LocalizedProjectFields>>> = {
  lizhang: {
    en: {
      title: 'LizhangApp',
      subtitle: 'Gift & Cash Tracker',
      tagline: 'A native Android app tailored for interpersonal relations and reciprocal gift tracking',
      categoryLabel: 'Android / Compose',
      description: 'Built with Jetpack Compose, emphasizing micro-interactions and strict offline local privacy for personal gift bookkeeping.',
      overview: 'Traditional social reciprocity involves frequent gift exchanges. Lizhang bridges individuals and life events, ensuring clear ledger clarity.',
      features: [
        'Bidirectional ledger: track received gifts and outgoing social expenses',
        'Relationship genealogy: aggregate historical interactions per contact',
        '100% Offline-first: local Room database with zero cloud dependency',
        'Fast fuzzy search: filter by event, date, and contact',
        'Encrypted local backup & export'
      ],
      developmentNotes: 'Built entirely with Kotlin and Jetpack Compose declarative UI following modern Android guidelines (MVI / Clean Architecture).'
    },
    ja: {
      title: 'LizhangApp',
      subtitle: '交際費・祝儀記録',
      tagline: '人間関係と慶弔・ギフトのやり取りに特化したネイティブAndroidアプリ',
      categoryLabel: 'Android / Compose',
      description: 'Jetpack Composeで構築。丁寧なインタラクションと完全ローカル保存によるプライバシー保護を重視した家計簿アプリ。',
      overview: '冠婚葬祭や慶弔ギフトの記録をシンプルに整理。「人と出来事」を結びつけ、誰とのやり取りかを明確に記録します。',
      features: [
        '双方向台帳：受け取ったお祝いとお返しの支出を明確に管理',
        '関係性サマリー：親族や友人ごとの過去の記録を自動集計',
        '100% オフライン優先：外部通信なし、Roomデータベースで完全ローカル保存',
        '高速あいまい検索：日付・人物・名目でワンクリック絞り込み',
        '暗号化ローカルバックアップとデータ復元'
      ],
      developmentNotes: 'KotlinとJetpack Composeを採用し、現代的なAndroid設計思想（MVI / クリーンアーキテクチャ）に基づき開発。'
    }
  },
  'online-exam': {
    en: {
      title: 'Online Assessment System',
      subtitle: 'Academic Exam Platform',
      tagline: 'Online examination and automated grading platform with real-time proctoring and multi-dimensional analysis',
      categoryLabel: 'Web / Fullstack',
      description: 'Academic exam and assignment auto-evaluation system featuring real-time isolation, anti-cheating, code sandboxing, and score insights.',
      overview: 'Custom-built learning platform for university computer science courses, handling high concurrent submissions and instant code sandboxing.',
      features: [
        'Automated judging engine: multi-language isolated container evaluation',
        'Intelligent anti-cheating: tab-switch monitoring and multi-device alerts',
        'Visualized score profiles: class skill breakdown and distribution radars',
        'High availability: token-bucket rate limiting and distributed locks'
      ],
      developmentNotes: 'Frontend built with Vue 3 + TypeScript; backend microservices powered by Spring Boot and Docker sandboxing.'
    },
    ja: {
      title: 'オンライン試験・自動採点システム',
      subtitle: '大学向け評価プラットフォーム',
      tagline: 'リアルタイム不正検知と多角的データ分析を備えたオンライン試験・課題自動採点基盤',
      categoryLabel: 'Web / Fullstack',
      description: '大学の講義向けオンライン試験システム。権限分離、不正防止、コード自動判定、多角的な成績分析を提供。',
      overview: '情報科学系の授業向けに設計された学習評価基盤。同時答案提出に対応し、安全なコード実行サンドボックスを備えます。',
      features: [
        '自動採点エンジン：隔離コンテナ内でのマルチ言語コード安全評価',
        'スマート不正監視：タブ切り替え検知や重複ログインの警告通知',
        '成績可視化：理解度レーダーチャートと点数分布グラフ',
        '高可用性設計：Redisキャッシュと分散ロックによる高負荷対策'
      ],
      developmentNotes: 'フロントエンドはVue 3 + TypeScript、バックエンドはSpring BootとDockerサンドボックスで安全性を担保。'
    }
  },
  'dev-tools': {
    en: {
      title: 'Developer Utilities Kit',
      subtitle: 'Efficiency Toolset',
      tagline: 'A lightweight collection of high-frequency development and efficiency utilities with format converters and scripts',
      categoryLabel: 'CLI / Tools',
      description: 'Everyday developer utilities including API testing, format conversion, regex debugging, and automation scripts.',
      overview: 'Frequent development tasks require timestamp converters, JWT decoders, Base64 encodings, and Cron validators. This toolkit unifies client-side tools.',
      features: [
        'Sub-millisecond local execution without uploading sensitive data',
        'Dual workflows: terminal CLI and responsive desktop Web interface',
        'Interactive regex generator with real-time syntax highlighting',
        'One-click mock data generation and TypeScript type synthesis'
      ],
      developmentNotes: 'Core algorithms compiled to WebAssembly via Rust for zero lag on large payloads.'
    },
    ja: {
      title: '開発者向けユーティリティ集',
      subtitle: '効率化ツールキット',
      tagline: '日常的に高頻度で使う開発・作業効率化ツールと自動化スクリプトのコレクション',
      categoryLabel: 'CLI / Tools',
      description: 'APIテスト、データフォーマット変換、正規表現デバッグ、自動化スクリプトなど日常の開発を支えるツール群。',
      overview: 'タイムスタンプ変換、JWT解析、Base64エンコード、Cron式検証など、頻出する作業を安全なローカル環境に集約。',
      features: [
        '機密データを一切外部送信しないミリ秒単位のローカル動作',
        'ターミナルCLIとWebブラウザの2形態をサポート',
        '正規表現ジェネレーターとリアルタイム構文ハイライト',
        'モックデータ生成およびTypeScript型定義のワンクリック出力'
      ],
      developmentNotes: '大容量テキスト処理のボトルネックを解消するため、主要ロジックをRustからWebAssemblyにコンパイル。'
    }
  },
  'ai-lab': {
    en: {
      title: 'AI Lab & Experiments',
      subtitle: 'Agent Architecture',
      tagline: 'Experimental applications exploring LLM workflows, agent orchestration, and edge intelligence',
      categoryLabel: 'AI / Experiment',
      description: 'Explorations in LLM-powered workflows, focused on lightweight local automation and intelligent coding assistants.',
      overview: 'Investigating LLM applications in personal knowledge management and automated coding, testing hybrid local/cloud models.',
      features: [
        'Multi-model routing: lightweight local models for triage, cloud LLMs for deep reasoning',
        'Markdown semantic chunking RAG engine with 40% higher precision',
        'Automated function calling and task-planning loops'
      ],
      developmentNotes: 'Built with Python async event loops and SSE streaming for snappy typewriter dialogue.'
    },
    ja: {
      title: 'AI Lab & 実験的プロトタイプ',
      subtitle: 'AIエージェントの探求',
      tagline: '大規模言語モデルとAgentアーキテクチャを活用した、端側知能と自動化ワークフローの実験',
      categoryLabel: 'AI / Experiment',
      description: 'LLMとAgentアーキテクチャの実験的活用。軽量なローカル自動化と知的な開発アシスタントを追求。',
      overview: 'ナレッジ管理とコーディング支援におけるLLMの実践。ローカル軽量モデルとクラウドモデルのハイブリッド構成を検証。',
      features: [
        'マルチモデルルーティング：ローカルモデルで一次選別、高度な推論はクラウドへ',
        'Markdown意味分割RAGエンジンによるコード検索適合率向上',
        'ツール呼び出し（Function Calling）と自律タスクループ'
      ],
      developmentNotes: 'Pythonの非同期コルーチンとSSEストリーミングにより、低遅延なタイピング出力を実現。'
    }
  },
  'open-source': {
    en: {
      title: 'Open Source Contributions',
      subtitle: 'GitHub Ecosystem',
      tagline: 'Actively participating in open source communities, maintaining repositories, and submitting pragmatic PRs',
      categoryLabel: 'Open Source',
      description: 'Open-source contributions on GitHub: scaffolding tools, reusable components, and technical documentation.',
      overview: 'Embracing open source by decoupling valuable everyday tools—hooks libraries, lightweight CLIs, and starter templates.',
      features: [
        'Conventional commits and automated semantic release CI pipelines',
        'Comprehensive documentation with bilingual guides and interactive demos',
        'Prompt issue triage and community pull request collaboration'
      ],
      developmentNotes: 'Maintaining >85% unit test coverage using GitHub Actions matrix pipelines.'
    },
    ja: {
      title: 'オープンソース貢献とコミュニティ',
      subtitle: 'GitHub開発',
      tagline: 'オープンソースコミュニティへの積極的な参加、自作ライブラリの保守とPRの提出',
      categoryLabel: 'Open Source',
      description: 'GitHub上でのオープンソース活動。便利なボイラープレート、UIコンポーネント、技術ドキュメントの共有。',
      overview: 'オープンソースの精神に共鳴し、日常の開発で培った有用なコードをライブラリやCLIツールとして切り出して公開。',
      features: [
        '規約に沿ったGitコミット運用と自動セマンティックバージョニング',
        'バイリンガル対応の丁寧な解説ドキュメントとデモ提供',
        'コミュニティからのIssue対応と質の高いPRのマージ'
      ],
      developmentNotes: 'ユニットテスト網羅率85%以上を維持し、GitHub Actionsでマルチプラットフォーム検証を実施。'
    }
  },
  'fuji-photo': {
    en: {
      title: 'Fujifilm Colors & Visual Diary',
      subtitle: 'Slices of Life',
      tagline: 'Documenting life beyond code through light, film simulation, and quiet streetscapes',
      categoryLabel: 'Photography / Notes',
      description: 'Film tones and visual journal. Capturing multidimensional light, shadow, and quiet streets in Chongqing.',
      overview: 'Code is the realm of logic; photography is the domain of perception. Freezing quiet streetscapes and transient light brings balance to hours at the screen.',
      features: [
        'Custom Classic Chrome and Classic Neg recipe tuning',
        'Visual archive of Chongqing architecture and neon reflections',
        'Minimalist framing and negative space studies'
      ],
      developmentNotes: 'Lightweight gallery with lossless WebP compression and lazy loading.'
    },
    ja: {
      title: '富士フイルムの色と写真ノート',
      subtitle: '日常の断片とフィルム調',
      tagline: 'コードの外側にある日々の光景、光と影のストリートスナップ。レンズを通して捉えた静かな瞬間',
      categoryLabel: 'Photography / Notes',
      description: 'フィルムシミュレーションによる写真記録。重慶の立体的な光と影、静かな街角を記録。',
      overview: 'コードが論理の世界なら、写真は感性の世界。通り過ぎる光や街の息づかいを切り取ることで、開発生活に深呼吸をもたらします。',
      features: [
        'Classic ChromeとClassic Negのカスタムレシピ記録',
        '坂と階段の街・重慶の立体的な陰影と夜の反射光',
        'ミニマルな構図と余白を意識したビジュアル探求'
      ],
      developmentNotes: '軽量ギャラリー設計。WebP圧縮とオンデマンド遅延読み込みで快適な表示を実現。'
    }
  },
  plantly: {
    en: {
      title: 'Plantly',
      subtitle: 'Plant Care Companion',
      tagline: 'A minimal indoor plant tracker and watering reminder to nurture everyday desktop greenery',
      categoryLabel: 'Web / React',
      description: 'Minimal plant care journal and schedule tracker to accompany desktop greenery.',
      overview: 'Indoor plants often suffer from forgotten waterings or over-saturation. Plantly provides calm care cycles without distraction.',
      features: [
        'Adaptive watering schedule adjusted for season and humidity',
        'Growth timeline and leaf progression comparisons',
        'Offline PWA support with desktop badge alerts'
      ],
      developmentNotes: 'Powered by IndexedDB for local zero-cloud storage with exportable snapshots.'
    },
    ja: {
      title: 'Plantly',
      subtitle: '観葉植物のお世話サポーター',
      tagline: '室内グリーンの成長と水やりを記録する、シンプルで心地よいリマインダーツール',
      categoryLabel: 'Web / React',
      description: 'デスクに置かれた植物の健康を静かに見守る、ミニマルな植物管理アプリ。',
      overview: '水やりの忘れや過度な給水による根腐れを防ぎ、植物の健やかな成長を優しくサポートします。',
      features: [
        '季節や気温に応じたスマート水やり周期アルゴリズム',
        '葉の変化や新芽の成長を記録するフォトギャラリー',
        'PWAによるローカルインストールとオフライン通知対応'
      ],
      developmentNotes: '端末ローカルのIndexedDBを活用し、完全なデータ管理とプライバシーを確保。'
    }
  },
  orbit: {
    en: {
      title: 'Orbit',
      subtitle: 'Focus Timer & Ambient Noise',
      tagline: 'A minimal Pomodoro clock and procedural soundscapes designed for uninterrupted flow',
      categoryLabel: 'Web / Audio',
      description: 'Minimalist white noise and focused clock: pure time progression animations to block distractions and stay in flow.',
      overview: 'Amid rapid notification feeds, deep single-task focus is precious. Orbit strips away vanity metrics to honor time and sound.',
      features: [
        'Procedural sound engine via Web Audio API (rain, campfire, pink noise)',
        'Fluid orbital planetary timer visualization',
        'Global shortcuts and immersive fullscreen mode'
      ],
      developmentNotes: 'Zero heavy audio files: procedural math waveforms under 50KB total bundle size.'
    },
    ja: {
      title: 'Orbit',
      subtitle: '集中タイマー & 環境音',
      tagline: '雨音や波の音とともに深い集中状態をつくる、ミニマルなポモドーロタイマー',
      categoryLabel: 'Web / Audio',
      description: 'ミニマルな環境音と集中タイマー。余計な情報を遮断し、心地よい作業フローへ導きます。',
      overview: '通知の多い現代において、ひとつの作業に没頭する時間は貴重です。Orbitは複雑な統計を削ぎ落とし、純粋な時間と音を提供します。',
      features: [
        'Web Audio APIによる自然音（雨音、焚き火、ピンクノイズ）のリアルタイム合成',
        '美しい天体軌道カウントダウンアニメーション',
        'ショートカットキー操作とフルスクリーン没入モード'
      ],
      developmentNotes: '重い音声ファイルを持たず、数式によるリアルタイム音響合成で50KB未満の軽量性を達成。'
    }
  },
  flowy: {
    en: {
      title: 'Flowy',
      subtitle: 'Thought Outliner',
      tagline: 'Lightweight folding outliner and mind map view to unravel complex engineering ideas',
      categoryLabel: 'Tools / Web',
      description: 'Distraction-free outliner that smoothly switches between nested lists and mind map nodes.',
      overview: 'Complex engineering challenges often begin as fragmented thoughts. Flowy facilitates structured brainstorming without modal friction.',
      features: [
        'Infinite-nested collapsible outline nodes',
        'Zero-latency switch between outline and visual mind map',
        'Markdown import/export with local encryption'
      ],
      developmentNotes: 'Canvas render graph built with custom lightweight SVG nodes.'
    },
    ja: {
      title: 'Flowy',
      subtitle: '思考整理アウトライナー',
      tagline: '思考の断片をツリー構造とマインドマップで軽やかに整理・俯瞰するツール',
      categoryLabel: 'Tools / Web',
      description: '階層リストとマインドマップを自在に行き来できる、思考のためのシンプルなアウトライナー。',
      overview: '複雑な設計やアイデアを、摩擦なく自然なツリー構造へ落とし込み、頭の中をクリアに整理します。',
      features: [
        'キーボード中心の軽快な階層ノード折りたたみ操作',
        'リスト表示とマインドマップ表示のシームレス切り替え',
        'Markdown形式のインポート・エクスポートとローカル保存'
      ],
      developmentNotes: '余計な描画負荷を排除した軽量SVGレンダリングエンジンを採用。'
    }
  },
  'minimal-tab': {
    en: {
      title: 'Minimal Tab',
      subtitle: 'Calm Browser Start Page',
      tagline: 'A calm, customizable new tab page with daily inspiration and uncluttered quick-access links',
      categoryLabel: 'Browser / Extension',
      description: 'Replaces noisy default browser tabs with clean typography, daily quotes, and minimal shortcuts.',
      overview: 'Opening a new browser tab should bring clarity rather than algorithmic news feeds.',
      features: [
        'Zero-tracking privacy guarantee',
        'Minimalist analog and digital clock options',
        'Keyboard-accessible quick bookmark launcher'
      ],
      developmentNotes: 'Ultra-fast cold startup under 15ms with zero third-party dependencies.'
    },
    ja: {
      title: 'Minimal Tab',
      subtitle: '静謐なブラウザ起動ページ',
      tagline: '広告や余計なニュースを排除し、静かなタイポグラフィとショートカットを提供する新規タブ拡張',
      categoryLabel: 'Browser / Extension',
      description: 'ブラウザの新しいタブを、静かで心地よい作業の出発点に変えるミニマル拡張機能。',
      overview: 'ブラウザを開くたびに飛び込んでくる過剰な情報を整理し、穏やかな集中をもたらします。',
      features: [
        'ユーザー行動追跡の一切ない完全なプライバシー保護',
        '美しいアナログ＆デジタル時計と静かなタイポグラフィ',
        'キーボードで素早く呼び出せるスマートブックマーク'
      ],
      developmentNotes: '15ms未満の高速な初期起動を実現し、ブラウザ動作に一切の負荷をかけません。'
    }
  }
};
