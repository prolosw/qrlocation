/**
 * Aligo(알리고) SMS API 연동 유틸리티입니다.
 * .env에 설정된 API Key, User ID, Sender 번호를 기반으로 문자를 발송합니다.
 */
export async function sendSMS({
  receiver,
  msg,
}: {
  receiver: string;
  msg: string;
}) {
  const key = process.env.ALIGO_API_KEY;
  const userid = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;

  if (!key || !userid || !sender) {
    console.log(`[Aligo SMS Mock] API 설정 누락. 발송 대상: ${receiver}, 메시지: "${msg}"`);
    return { success: true, mock: true };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('key', key);
    formData.append('userid', userid);
    formData.append('sender', sender);
    formData.append('receiver', receiver.replace(/\D/g, '')); // 숫자만 추출
    formData.append('msg', msg);
    // 한글 메시지가 길 경우 자동으로 LMS 처리될 수 있도록 알리고 옵션
    formData.append('msg_type', msg.length > 90 ? 'LMS' : 'SMS');

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      throw new Error(`Aligo HTTP responded with status ${res.status}`);
    }

    const data = await res.json();
    
    // 알리고 성공 결과 코드는 문자열 "1" 또는 숫자 1
    if (data.result_code === '1' || data.result_code === 1) {
      console.log(`[Aligo SMS Success] Sent to ${receiver}: "${msg}"`);
      return { success: true, data };
    } else {
      console.error(`[Aligo SMS Failure] Code ${data.result_code}: ${data.message}`);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('[Aligo SMS System Error]:', error);
    return { success: false, error };
  }
}
