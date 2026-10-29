export const VALIDATION_CASES={
  "audio": [
    {
      "key": "valid",
      "title": "正常样例",
      "description": "3 条语音/噪声结构合格；教学 ASR 错字不在结构判断范围。",
      "fix": "无需修正；仍需试听检查内容。",
      "format": "json",
      "text": "{\n  \"schema_version\": 1,\n  \"project\": \"dolphin\",\n  \"records\": [\n    {\n      \"id\": \"dolphin_demo_1\",\n      \"source_id\": \"demo_meeting\",\n      \"audio_file\": \"meeting.wav\",\n      \"duration\": 4.898,\n      \"language\": \"中文\",\n      \"dialect\": \"普通话\",\n      \"scene\": \"普通话合成教学\",\n      \"kind\": \"speech\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 4.898,\n          \"asr\": \"今天下午四点，我们在会义室开会。\",\n          \"text\": \"今天下午四点，我们在会义室开会。\",\n          \"speaker\": \"speaker_1\"\n        }\n      ],\n      \"noise_tags\": [],\n      \"is_demo\": true,\n      \"reference\": \"今天下午三点，我们在会议室开会。\"\n    },\n    {\n      \"id\": \"dolphin_demo_2\",\n      \"source_id\": \"demo_weather\",\n      \"audio_file\": \"weather.wav\",\n      \"duration\": 4.645,\n      \"language\": \"中文\",\n      \"dialect\": \"普通话\",\n      \"scene\": \"普通话合成教学\",\n      \"kind\": \"speech\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 4.645,\n          \"asr\": \"明天上午有小语，出门记得代伞。\",\n          \"text\": \"明天上午有小语，出门记得代伞。\",\n          \"speaker\": \"speaker_1\"\n        }\n      ],\n      \"noise_tags\": [],\n      \"is_demo\": true,\n      \"reference\": \"明天上午有小雨，出门记得带伞。\"\n    },\n    {\n      \"id\": \"dolphin_demo_3\",\n      \"source_id\": \"demo_noise\",\n      \"audio_file\": \"noise.wav\",\n      \"duration\": 1.5,\n      \"language\": \"中文\",\n      \"dialect\": \"待判定\",\n      \"scene\": \"程序生成噪声\",\n      \"kind\": \"noise\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 1.5,\n          \"asr\": \"[噪声]\",\n          \"text\": \"[噪声]\",\n          \"speaker\": \"不适用\"\n        }\n      ],\n      \"noise_tags\": [\n        \"背景噪声\"\n      ],\n      \"is_demo\": true,\n      \"reference\": \"\"\n    }\n  ]\n}\n"
    },
    {
      "key": "time_out",
      "title": "时间越界",
      "description": "结束时间超过声明 duration。",
      "fix": "核对音频后修正 segments[0].end，不能随意改大 duration。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_time_out\",\n    \"source_id\": \"demo_time_out\",\n    \"audio_file\": \"meeting.wav\",\n    \"duration\": 4.898,\n    \"language\": \"中文\",\n    \"dialect\": \"普通话\",\n    \"scene\": \"普通话合成教学\",\n    \"kind\": \"speech\",\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 5.898,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"今天下午四点，我们在会义室开会。\",\n        \"speaker\": \"speaker_1\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"今天下午三点，我们在会议室开会。\"\n  }\n]\n"
    },
    {
      "key": "reversed",
      "title": "起止颠倒",
      "description": "结束时间早于开始时间。",
      "fix": "依据音频修正 start/end，确保正时长。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_reversed\",\n    \"source_id\": \"demo_reversed\",\n    \"audio_file\": \"meeting.wav\",\n    \"duration\": 4.898,\n    \"language\": \"中文\",\n    \"dialect\": \"普通话\",\n    \"scene\": \"普通话合成教学\",\n    \"kind\": \"speech\",\n    \"segments\": [\n      {\n        \"start\": 3,\n        \"end\": 1,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"今天下午四点，我们在会义室开会。\",\n        \"speaker\": \"speaker_1\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"今天下午三点，我们在会议室开会。\"\n  }\n]\n"
    },
    {
      "key": "missing",
      "title": "转写缺失",
      "description": "text 留空，缺少人工转写。",
      "fix": "听音后补齐 text；非语音使用约定标记。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_transcript_missing\",\n    \"source_id\": \"demo_transcript_missing\",\n    \"audio_file\": \"meeting.wav\",\n    \"duration\": 4.898,\n    \"language\": \"中文\",\n    \"dialect\": \"普通话\",\n    \"scene\": \"普通话合成教学\",\n    \"kind\": \"speech\",\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 4.898,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"\",\n        \"speaker\": \"speaker_1\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"今天下午三点，我们在会议室开会。\"\n  }\n]\n"
    },
    {
      "key": "speaker",
      "title": "说话人缺失",
      "description": "speaker 留空。",
      "fix": "补充说话人编号，纯噪声可填“不适用”。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_speaker_missing\",\n    \"source_id\": \"demo_speaker_missing\",\n    \"audio_file\": \"meeting.wav\",\n    \"duration\": 4.898,\n    \"language\": \"中文\",\n    \"dialect\": \"普通话\",\n    \"scene\": \"普通话合成教学\",\n    \"kind\": \"speech\",\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 4.898,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"今天下午四点，我们在会义室开会。\",\n        \"speaker\": \"\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"今天下午三点，我们在会议室开会。\"\n  }\n]\n"
    },
    {
      "key": "noise",
      "title": "噪声漏标",
      "description": "kind=noise，但 noise_tags 为空。",
      "fix": "按声音补充背景噪声、音乐、静音等约定标签。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_noise_missing\",\n    \"source_id\": \"demo_noise_missing\",\n    \"audio_file\": \"noise.wav\",\n    \"duration\": 1.5,\n    \"language\": \"中文\",\n    \"dialect\": \"待判定\",\n    \"scene\": \"程序生成噪声\",\n    \"kind\": \"noise\",\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 1.5,\n        \"asr\": \"[噪声]\",\n        \"text\": \"[噪声]\",\n        \"speaker\": \"不适用\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"\"\n  }\n]\n"
    },
    {
      "key": "invalid",
      "title": "全部异常",
      "description": "5 条记录，分别展示越界、颠倒、缺转写、缺说话人和噪声漏标。",
      "fix": "逐条定位修改，或查看修正后的对应五条记录。",
      "format": "jsonl",
      "text": "{\"id\": \"audio_time_out\", \"source_id\": \"demo_time_out\", \"audio_file\": \"meeting.wav\", \"duration\": 4.898, \"language\": \"中文\", \"dialect\": \"普通话\", \"scene\": \"普通话合成教学\", \"kind\": \"speech\", \"segments\": [{\"start\": 0, \"end\": 5.898, \"asr\": \"今天下午四点，我们在会义室开会。\", \"text\": \"今天下午四点，我们在会义室开会。\", \"speaker\": \"speaker_1\"}], \"noise_tags\": [], \"is_demo\": true, \"reference\": \"今天下午三点，我们在会议室开会。\"}\n{\"id\": \"audio_reversed\", \"source_id\": \"demo_reversed\", \"audio_file\": \"meeting.wav\", \"duration\": 4.898, \"language\": \"中文\", \"dialect\": \"普通话\", \"scene\": \"普通话合成教学\", \"kind\": \"speech\", \"segments\": [{\"start\": 3, \"end\": 1, \"asr\": \"今天下午四点，我们在会义室开会。\", \"text\": \"今天下午四点，我们在会义室开会。\", \"speaker\": \"speaker_1\"}], \"noise_tags\": [], \"is_demo\": true, \"reference\": \"今天下午三点，我们在会议室开会。\"}\n{\"id\": \"audio_transcript_missing\", \"source_id\": \"demo_transcript_missing\", \"audio_file\": \"meeting.wav\", \"duration\": 4.898, \"language\": \"中文\", \"dialect\": \"普通话\", \"scene\": \"普通话合成教学\", \"kind\": \"speech\", \"segments\": [{\"start\": 0, \"end\": 4.898, \"asr\": \"今天下午四点，我们在会义室开会。\", \"text\": \"\", \"speaker\": \"speaker_1\"}], \"noise_tags\": [], \"is_demo\": true, \"reference\": \"今天下午三点，我们在会议室开会。\"}\n{\"id\": \"audio_speaker_missing\", \"source_id\": \"demo_speaker_missing\", \"audio_file\": \"meeting.wav\", \"duration\": 4.898, \"language\": \"中文\", \"dialect\": \"普通话\", \"scene\": \"普通话合成教学\", \"kind\": \"speech\", \"segments\": [{\"start\": 0, \"end\": 4.898, \"asr\": \"今天下午四点，我们在会义室开会。\", \"text\": \"今天下午四点，我们在会义室开会。\", \"speaker\": \"\"}], \"noise_tags\": [], \"is_demo\": true, \"reference\": \"今天下午三点，我们在会议室开会。\"}\n{\"id\": \"audio_noise_missing\", \"source_id\": \"demo_noise_missing\", \"audio_file\": \"noise.wav\", \"duration\": 1.5, \"language\": \"中文\", \"dialect\": \"待判定\", \"scene\": \"程序生成噪声\", \"kind\": \"noise\", \"segments\": [{\"start\": 0, \"end\": 1.5, \"asr\": \"[噪声]\", \"text\": \"[噪声]\", \"speaker\": \"不适用\"}], \"noise_tags\": [], \"is_demo\": true, \"reference\": \"\"}\n"
    },
    {
      "key": "corrected",
      "title": "修正后示例",
      "description": "保留原五条异常记录编号，分别修正五类问题。",
      "fix": "应为 5 条通过；修正依据在实际任务中来自音频。",
      "format": "json",
      "text": "{\n  \"schema_version\": 1,\n  \"project\": \"dolphin\",\n  \"records\": [\n    {\n      \"id\": \"audio_time_out\",\n      \"source_id\": \"demo_time_out\",\n      \"audio_file\": \"meeting.wav\",\n      \"duration\": 4.898,\n      \"language\": \"中文\",\n      \"dialect\": \"普通话\",\n      \"scene\": \"普通话合成教学\",\n      \"kind\": \"speech\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 4.898,\n          \"asr\": \"今天下午四点，我们在会义室开会。\",\n          \"text\": \"今天下午四点，我们在会义室开会。\",\n          \"speaker\": \"speaker_1\"\n        }\n      ],\n      \"noise_tags\": [],\n      \"is_demo\": true,\n      \"reference\": \"今天下午三点，我们在会议室开会。\"\n    },\n    {\n      \"id\": \"audio_reversed\",\n      \"source_id\": \"demo_reversed\",\n      \"audio_file\": \"meeting.wav\",\n      \"duration\": 4.898,\n      \"language\": \"中文\",\n      \"dialect\": \"普通话\",\n      \"scene\": \"普通话合成教学\",\n      \"kind\": \"speech\",\n      \"segments\": [\n        {\n          \"start\": 1,\n          \"end\": 3,\n          \"asr\": \"今天下午四点，我们在会义室开会。\",\n          \"text\": \"今天下午四点，我们在会义室开会。\",\n          \"speaker\": \"speaker_1\"\n        }\n      ],\n      \"noise_tags\": [],\n      \"is_demo\": true,\n      \"reference\": \"今天下午三点，我们在会议室开会。\"\n    },\n    {\n      \"id\": \"audio_transcript_missing\",\n      \"source_id\": \"demo_transcript_missing\",\n      \"audio_file\": \"meeting.wav\",\n      \"duration\": 4.898,\n      \"language\": \"中文\",\n      \"dialect\": \"普通话\",\n      \"scene\": \"普通话合成教学\",\n      \"kind\": \"speech\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 4.898,\n          \"asr\": \"今天下午四点，我们在会义室开会。\",\n          \"text\": \"今天下午三点，我们在会议室开会。\",\n          \"speaker\": \"speaker_1\"\n        }\n      ],\n      \"noise_tags\": [],\n      \"is_demo\": true,\n      \"reference\": \"今天下午三点，我们在会议室开会。\"\n    },\n    {\n      \"id\": \"audio_speaker_missing\",\n      \"source_id\": \"demo_speaker_missing\",\n      \"audio_file\": \"meeting.wav\",\n      \"duration\": 4.898,\n      \"language\": \"中文\",\n      \"dialect\": \"普通话\",\n      \"scene\": \"普通话合成教学\",\n      \"kind\": \"speech\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 4.898,\n          \"asr\": \"今天下午四点，我们在会义室开会。\",\n          \"text\": \"今天下午四点，我们在会义室开会。\",\n          \"speaker\": \"speaker_1\"\n        }\n      ],\n      \"noise_tags\": [],\n      \"is_demo\": true,\n      \"reference\": \"今天下午三点，我们在会议室开会。\"\n    },\n    {\n      \"id\": \"audio_noise_missing\",\n      \"source_id\": \"demo_noise_missing\",\n      \"audio_file\": \"noise.wav\",\n      \"duration\": 1.5,\n      \"language\": \"中文\",\n      \"dialect\": \"待判定\",\n      \"scene\": \"程序生成噪声\",\n      \"kind\": \"noise\",\n      \"segments\": [\n        {\n          \"start\": 0,\n          \"end\": 1.5,\n          \"asr\": \"[噪声]\",\n          \"text\": \"[噪声]\",\n          \"speaker\": \"不适用\"\n        }\n      ],\n      \"noise_tags\": [\n        \"背景噪声\"\n      ],\n      \"is_demo\": true,\n      \"reference\": \"\"\n    }\n  ]\n}\n"
    },
    {
      "key": "overlap",
      "title": "单通道片段重叠",
      "description": "两个片段在 2—3 秒重叠，当前单通道规则禁止。",
      "fix": "回听后对齐边界；真实混说需专项复核，不能用说明绕过规则。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_overlap\",\n    \"source_id\": \"demo_meeting\",\n    \"audio_file\": \"meeting.wav\",\n    \"duration\": 4.898,\n    \"language\": \"中文\",\n    \"dialect\": \"普通话\",\n    \"scene\": \"普通话合成教学\",\n    \"kind\": \"speech\",\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 3,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"今天下午四点，我们在会义室开会。\",\n        \"speaker\": \"speaker_1\"\n      },\n      {\n        \"start\": 2,\n        \"end\": 4,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"今天下午四点，我们在会义室开会。\",\n        \"speaker\": \"speaker_1\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"今天下午三点，我们在会议室开会。\"\n  }\n]"
    },
    {
      "key": "attribute",
      "title": "方言属性错误",
      "description": "dialect 不属于约定枚举。",
      "fix": "无法判断时填“待判定”，不要虚构方言识别结果。",
      "format": "json",
      "text": "[\n  {\n    \"id\": \"audio_attribute\",\n    \"source_id\": \"demo_meeting\",\n    \"audio_file\": \"meeting.wav\",\n    \"duration\": 4.898,\n    \"language\": \"中文\",\n    \"dialect\": \"模型自动猜测\",\n    \"scene\": \"普通话合成教学\",\n    \"kind\": \"speech\",\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 4.898,\n        \"asr\": \"今天下午四点，我们在会义室开会。\",\n        \"text\": \"今天下午四点，我们在会义室开会。\",\n        \"speaker\": \"speaker_1\"\n      }\n    ],\n    \"noise_tags\": [],\n    \"is_demo\": true,\n    \"reference\": \"今天下午三点，我们在会议室开会。\"\n  }\n]"
    }
  ],
  "video": [
    {
      "key": "valid",
      "title": "正常样例",
      "description": "4 秒声明时长，0—2 / 2—4 秒两段，七项描述齐全。",
      "fix": "首尾相接允许，不要求解释重叠。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_demo_001\",\n    \"video_path\": \"videos/demo_motion.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 2,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      },\n      {\n        \"start\": 2,\n        \"end\": 4,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "time_out",
      "title": "时间越界",
      "description": "duration=4，但片段 end=5。",
      "fix": "根据媒体与标注依据修正 end，而非随意扩大 duration。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_time_out\",\n    \"video_path\": \"videos/video_time_out.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 5,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "reversed",
      "title": "起止颠倒",
      "description": "start=3、end=1，片段没有正时长。",
      "fix": "修正为符合动作实际范围的起止点。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_reversed\",\n    \"video_path\": \"videos/video_reversed.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 3,\n        \"end\": 1,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "missing",
      "title": "动作描述缺失",
      "description": "captions[1] 为空，缺少动作序列与时序。",
      "fix": "观察动作后补充第二项描述。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_missing\",\n    \"video_path\": \"videos/video_missing.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 2,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "invalid",
      "title": "全部异常",
      "description": "3 条记录对应越界、起止颠倒和动作描述缺失。",
      "fix": "逐条修正或查看保留编号的修正后示例。",
      "format": "jsonl",
      "text": "{\"sample_id\": \"video_time_out\", \"video_path\": \"videos/video_time_out.webm\", \"duration\": 4, \"segments\": [{\"start\": 0, \"end\": 5, \"captions\": [\"一个带浅色条纹的蓝色球体（模拟描述）。\", \"球体从左向右连续滚动。\", \"固定镜头，无可观察运镜。\", \"背景均匀明亮，具体光源不可判断。\", \"球体沿水平地面滚动。\", \"程序绘制质感，真实材质不可判断。\", \"球体底部与地面接触，没有其他可见主体。\"], \"overlap_reason\": \"\"}], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"video_reversed\", \"video_path\": \"videos/video_reversed.webm\", \"duration\": 4, \"segments\": [{\"start\": 3, \"end\": 1, \"captions\": [\"一个带浅色条纹的蓝色球体（模拟描述）。\", \"球体从左向右连续滚动。\", \"固定镜头，无可观察运镜。\", \"背景均匀明亮，具体光源不可判断。\", \"球体沿水平地面滚动。\", \"程序绘制质感，真实材质不可判断。\", \"球体底部与地面接触，没有其他可见主体。\"], \"overlap_reason\": \"\"}], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"video_missing\", \"video_path\": \"videos/video_missing.webm\", \"duration\": 4, \"segments\": [{\"start\": 0, \"end\": 2, \"captions\": [\"一个带浅色条纹的蓝色球体（模拟描述）。\", \"\", \"固定镜头，无可观察运镜。\", \"背景均匀明亮，具体光源不可判断。\", \"球体沿水平地面滚动。\", \"程序绘制质感，真实材质不可判断。\", \"球体底部与地面接触，没有其他可见主体。\"], \"overlap_reason\": \"\"}], \"split\": \"train\", \"is_demo\": true}\n"
    },
    {
      "key": "corrected",
      "title": "修正后示例",
      "description": "同三条记录已修正时序和动作描述。",
      "fix": "应为 3 条通过；不是模型质量合格的结论。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_time_out\",\n    \"video_path\": \"videos/video_time_out.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 4,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  },\n  {\n    \"sample_id\": \"video_reversed\",\n    \"video_path\": \"videos/video_reversed.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 1,\n        \"end\": 3,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  },\n  {\n    \"sample_id\": \"video_missing\",\n    \"video_path\": \"videos/video_missing.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 2,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动（补齐的模拟描述）。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "overlap",
      "title": "重叠原因缺失",
      "description": "视频允许不同维度同时标注，但重叠片段必须说明原因。",
      "fix": "核对合理性后填写 overlap_reason，或依据视频修正边界。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_overlap\",\n    \"video_path\": \"videos/demo_motion.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 2,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      },\n      {\n        \"start\": 1,\n        \"end\": 4,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]"
    },
    {
      "key": "caption_count",
      "title": "七项描述数量错误",
      "description": "第一个片段只有六项 captions。",
      "fix": "依固定顺序补齐第七项“场景交互”，不可只改数组长度。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"video_caption_count\",\n    \"video_path\": \"videos/demo_motion.webm\",\n    \"duration\": 4,\n    \"segments\": [\n      {\n        \"start\": 0,\n        \"end\": 2,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\"\n        ],\n        \"overlap_reason\": \"\"\n      },\n      {\n        \"start\": 2,\n        \"end\": 4,\n        \"captions\": [\n          \"一个带浅色条纹的蓝色球体（模拟描述）。\",\n          \"球体从左向右连续滚动。\",\n          \"固定镜头，无可观察运镜。\",\n          \"背景均匀明亮，具体光源不可判断。\",\n          \"球体沿水平地面滚动。\",\n          \"程序绘制质感，真实材质不可判断。\",\n          \"球体底部与地面接触，没有其他可见主体。\"\n        ],\n        \"overlap_reason\": \"\"\n      }\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]"
    }
  ],
  "image": [
    {
      "key": "valid",
      "title": "正常样例",
      "description": "2 条 Caption、标签、图片引用与划分完整的图文记录。",
      "fix": "图片引用按随包三张实际加载成功的清单核对。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"demo_001\",\n    \"image_path\": \"images/placeholder_a.png\",\n    \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\",\n    \"tags\": [\n      \"插画\"\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  },\n  {\n    \"sample_id\": \"demo_002\",\n    \"image_path\": \"images/placeholder_b.png\",\n    \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\",\n    \"tags\": [\n      \"插画\"\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "practice_before",
      "title": "缺 Caption 练习",
      "description": "一条图文记录缺少 caption 字段。",
      "fix": "补充非空字符串 caption，再重新校验。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"practice_001\",\n    \"image_path\": \"images/placeholder_a.png\",\n    \"tags\": [\n      \"插画\"\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "practice_after",
      "title": "补齐 Caption 后",
      "description": "保留练习记录编号并补齐 caption。",
      "fix": "应为 1 条通过；图文内容仍需人工判断。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"practice_001\",\n    \"image_path\": \"images/placeholder_a.png\",\n    \"caption\": \"模拟训练描述，用于练习补齐字段；不代表占位图片的语义。\",\n    \"tags\": [\"插画\"],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]\n"
    },
    {
      "key": "invalid",
      "title": "全部异常",
      "description": "13 行覆盖重复 ID、缺字段、类型、标签、路径、图片引用、划分和语法。",
      "fix": "先修复语法，再逐条修正；图片清单是当前检查范围。",
      "format": "jsonl",
      "text": "{\"sample_id\": \"duplicate_001\", \"image_path\": \"images/placeholder_a.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": [\"插画\"], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"duplicate_001\", \"image_path\": \"images/placeholder_b.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": [\"插画\"], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"missing_caption\", \"image_path\": \"images/placeholder_c.png\", \"tags\": [\"插画\"], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"wrong_tags\", \"image_path\": \"images/placeholder_b.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": \"插画\", \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"missing_image\", \"image_path\": \"images/not_found.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": [\"插画\"], \"split\": \"dev\", \"is_demo\": true}\n{\"sample_id\": \"blank_caption\", \"image_path\": \"images/placeholder_c.png\", \"caption\": \"   \", \"tags\": [\"未知\"], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\": \"syntax_error\",\n{\"sample_id\": \"cross_split\", \"image_path\": \"images/placeholder_a.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": [\"插画\"], \"split\": \"test\", \"is_demo\": true}\n{\"sample_id\": \"bad_tag_items\", \"image_path\": \"images/placeholder_b.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": [42, \"插画\", \"插画\"], \"split\": \"train\", \"is_demo\": true}\n[\"这一行不是对象\"]\n{\"sample_id\": \"outside_path\", \"image_path\": \"../outside.png\", \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\", \"tags\": [\"插画\"], \"split\": \"train\", \"is_demo\": true}\n{\"sample_id\":\"one\",\"sample_id\":\"two\"}\n{\"sample_id\": \"wrong_caption_type\", \"image_path\": \"images/placeholder_c.png\", \"caption\": 42, \"tags\": [\"插画\"], \"split\": \"train\", \"is_demo\": true}\n"
    },
    {
      "key": "tag_error",
      "title": "标签枚举与重复",
      "description": "标签数组包含重复值与约定外标签。",
      "fix": "删除重复值，用约定标签替换未知标签。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"tag_error\",\n    \"image_path\": \"images/placeholder_a.png\",\n    \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\",\n    \"tags\": [\n      \"插画\",\n      \"插画\",\n      \"未知标签\"\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]"
    },
    {
      "key": "missing_file",
      "title": "图片引用失效",
      "description": "路径合法，但当前文件清单找不到该图片。",
      "fix": "核对原始素材清单后修正路径或重新选择根目录。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"missing_file\",\n    \"image_path\": \"images/not_found.png\",\n    \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\",\n    \"tags\": [\n      \"插画\"\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]"
    },
    {
      "key": "path_escape",
      "title": "路径越界",
      "description": "图片引用试图逃出所选根目录。",
      "fix": "改为根目录内的相对图片路径。",
      "format": "json",
      "text": "[\n  {\n    \"sample_id\": \"path_escape\",\n    \"image_path\": \"../outside.png\",\n    \"caption\": \"模拟训练描述，用于展示字段校验，不代表占位图片内容。\",\n    \"tags\": [\n      \"插画\"\n    ],\n    \"split\": \"train\",\n    \"is_demo\": true\n  }\n]"
    }
  ]
};
