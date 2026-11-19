import { motion } from 'motion/react';
import { useGame } from '../store';
import { Modal } from './Overlay';

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3 text-left" aria-pressed={on}>
      <span>
        <span className="font-display block text-base">{label}</span>
        {hint && <span className="block text-xs text-cream/55">{hint}</span>}
      </span>
      <span className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? '#89A98B' : 'rgb(248 230 201 / .15)' }}>
        <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-cream shadow" animate={{ left: on ? 26 : 4 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }} />
      </span>
    </button>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings } = useGame();
  return (
    <Modal open={open} onClose={onClose} title="ตั้งค่า">
      <div className="flex flex-col gap-3">
        <Toggle on={settings.sound} onChange={(v) => setSettings({ sound: v })} label="เสียงเอฟเฟกต์" hint="เสียงจะเริ่มทำงานหลังแตะหน้าจอครั้งแรก" />
        <Toggle on={settings.reducedMotion} onChange={(v) => setSettings({ reducedMotion: v })} label="ลดการเคลื่อนไหว" hint="ลดแอนิเมชันสำหรับผู้ที่ไวต่อการเคลื่อนไหว" />
        <details className="rounded-2xl bg-black/20 px-4 py-3 text-sm text-cream/80">
          <summary className="font-display cursor-pointer text-base text-cream">วิธีเล่นย่อ ๆ</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>ลงการ์ดที่สี ตัวเลข หรือสัญลักษณ์ตรงกับใบบนสุด</li>
            <li>ไม่มีใบที่ลงได้ ให้จั่ว 1 ใบ ถ้าลงได้จะลงทันทีหรือเก็บไว้ก็ได้</li>
            <li>ข้าม · กลับทิศ (2 คนเท่ากับข้าม) · +2 ทำให้คนถัดไปจั่วและเสียตา</li>
            <li>ไวลด์ +4 ใช้ได้เมื่อไม่มีสีที่ตรง คนถัดไปท้าพิสูจน์ได้</li>
            <li>เหลือ 2 ใบ ให้กด UNO ก่อนลง ถ้าลืม คนอื่นจับได้ +2</li>
            <li>คนแรกที่การ์ดหมดมือชนะ และได้คะแนนจากการ์ดที่เหลือของคนอื่น</li>
          </ul>
        </details>
      </div>
    </Modal>
  );
}
