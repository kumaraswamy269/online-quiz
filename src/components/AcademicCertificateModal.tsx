import React from 'react';
import { Award, ShieldCheck, Printer, X, CheckCircle2, Calendar, Hash, School } from 'lucide-react';

interface AcademicCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: {
    studentName: string;
    studentEmail?: string;
    quizTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
    passPercentage: number;
    completedAt?: number | string;
    certificateCode: string;
    tabSwitchesCount?: number;
  };
}

export const AcademicCertificateModal: React.FC<AcademicCertificateModalProps> = ({
  isOpen,
  onClose,
  certificate,
}) => {
  if (!isOpen) return null;

  const issueDate = certificate.completedAt
    ? new Date(certificate.completedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Modal Top Actions (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
            <Award className="w-5 h-5 text-amber-400" />
            <span>Official Verifiable Credential</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Printable Canvas */}
        <div className="p-8 sm:p-12 text-center relative bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 print:from-white print:to-white print:p-8">
          
          {/* Ornate Double Border */}
          <div className="border-4 border-double border-amber-500/30 rounded-2xl p-6 sm:p-10 relative print:border-amber-600">
            
            {/* Corner Filigrees */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-400/80" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-400/80" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-400/80" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-400/80" />

            {/* Header / Seal */}
            <div className="flex flex-col items-center justify-center space-y-3 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
                <School className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-amber-400 font-bold font-mono">
                  QuizPulse Institute of Advanced Assessment
                </p>
                <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-wide text-white print:text-black">
                  Certificate of Academic Achievement
                </h1>
              </div>
            </div>

            {/* Presentation Text */}
            <p className="text-xs uppercase tracking-widest text-slate-400 print:text-slate-600 mb-2">
              This official credential certifies that
            </p>

            {/* Candidate Name */}
            <div className="my-4">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-amber-300 print:text-amber-800 tracking-wide border-b border-amber-500/20 pb-2 inline-block px-6">
                {certificate.studentName}
              </h2>
              {certificate.studentEmail && (
                <p className="text-xs text-slate-400 print:text-slate-600 mt-1 font-mono">
                  {certificate.studentEmail}
                </p>
              )}
            </div>

            {/* Assessment Details */}
            <p className="text-sm text-slate-300 print:text-slate-700 max-w-lg mx-auto mt-4 leading-relaxed">
              has satisfactorily completed and passed the server-proctored examination in
            </p>

            <h3 className="text-xl sm:text-2xl font-bold text-white print:text-black mt-2 mb-4">
              {certificate.quizTitle}
            </h3>

            {/* Performance Stats Pill */}
            <div className="inline-flex flex-wrap items-center justify-center gap-4 px-6 py-2 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs font-mono text-slate-300 print:bg-slate-100 print:text-black print:border-slate-300 my-4">
              <span><strong>Final Score:</strong> {certificate.score} / {certificate.maxScore}</span>
              <span>•</span>
              <span><strong>Percentage:</strong> {certificate.percentage}%</span>
              <span>•</span>
              <span><strong>Pass Standard:</strong> {certificate.passPercentage}%</span>
            </div>

            {/* Security & Verification Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-800 print:border-slate-300 text-left text-xs">
              
              <div>
                <span className="text-slate-500 print:text-slate-600 block uppercase font-mono tracking-wider text-[10px]">
                  Date Issued
                </span>
                <span className="font-medium text-slate-200 print:text-black flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {issueDate}
                </span>
              </div>

              <div className="sm:text-center">
                <span className="text-slate-500 print:text-slate-600 block uppercase font-mono tracking-wider text-[10px]">
                  Credential ID
                </span>
                <span className="font-mono font-bold text-amber-400 print:text-amber-800 flex items-center justify-start sm:justify-center gap-1 mt-0.5">
                  <Hash className="w-3.5 h-3.5 text-amber-500" />
                  {certificate.certificateCode}
                </span>
              </div>

              <div className="sm:text-right">
                <span className="text-slate-500 print:text-slate-600 block uppercase font-mono tracking-wider text-[10px]">
                  Proctoring Audit
                </span>
                <span className="font-medium text-emerald-400 print:text-emerald-700 flex items-center justify-start sm:justify-end gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Authentic & Verified
                </span>
              </div>

            </div>

          </div>

          {/* Verification URL Footer Note */}
          <p className="text-[10px] text-slate-500 print:text-slate-600 mt-4 font-mono">
            Cryptographically sealed and registered in the institutional RDBMS. Authenticate online using Credential ID: {certificate.certificateCode}.
          </p>

        </div>

      </div>
    </div>
  );
};
