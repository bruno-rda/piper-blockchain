import { useState } from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useProfiles } from '@/contexts/ProfileContext';
import { useCoins } from '@/hooks/useCoins';
import { useToast } from '@/contexts/ToastContext';
import { TruncatedAddress } from '@/components/TruncatedAddress';
import { prepareTransaction, submitTransaction } from '@/client';
import type { TransactionPrepareResponse } from '@/client';
import { decryptPrivateKey, signTransaction } from '@/lib/crypto';

type Step = 'compose' | 'review' | 'submitted';

export function SendPage() {
  const { profiles, activeProfile } = useProfiles();
  const { format, toAtomic, coinName } = useCoins();
  const { addToast } = useToast();

  const [step, setStep] = useState<Step>('compose');

  // Compose state
  const [fromAddress, setFromAddress] = useState(activeProfile?.address ?? '');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0');
  const [composeError, setComposeError] = useState('');
  const [composing, setComposing] = useState(false);

  // Review state
  const [prepareData, setPrepareData] = useState<TransactionPrepareResponse | null>(null);
  const [password, setPassword] = useState('');
  const [signError, setSignError] = useState('');
  const [signing, setSigning] = useState(false);

  // Submitted state
  const [submittedTxId, setSubmittedTxId] = useState('');

  const fromProfile = profiles.find((p) => p.address === fromAddress);

  const handlePreview = async () => {
    setComposeError('');

    if (!fromAddress) {
      setComposeError('Select a sender address.');
      return;
    }
    if (!toAddress.trim()) {
      setComposeError('Enter a recipient address.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setComposeError('Enter a valid amount.');
      return;
    }
    const feeNum = parseFloat(fee) || 0;

    setComposing(true);
    try {
      const res = await prepareTransaction({
        body: {
          sender_address: fromAddress,
          outputs: [{ recipient: toAddress.trim(), amount: toAtomic(amountNum) }],
          fee: toAtomic(feeNum),
        },
      });

      if (res.error) {
        const errDetail =
          (res.error as { detail?: string | Array<{ msg: string }> }).detail;
        if (typeof errDetail === 'string') {
          setComposeError(errDetail);
        } else if (Array.isArray(errDetail)) {
          setComposeError(errDetail.map((e) => e.msg).join(', '));
        } else {
          setComposeError('Failed to prepare transaction.');
        }
        return;
      }

      setPrepareData(res.data!);
      setStep('review');
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setComposing(false);
    }
  };

  const handleSignAndSubmit = async () => {
    if (!prepareData || !fromProfile) return;
    setSignError('');
    setSigning(true);

    try {
      // 1. Decrypt private key
      let privateKey: string;
      try {
        privateKey = await decryptPrivateKey(fromProfile.encryptedPrivateKey, password);
      } catch {
        setSignError('Wrong password.');
        setSigning(false);
        return;
      }

      // 2. Sign each input
      const signedInputs = prepareData.inputs.map((input) => {
        const messageToSign = input.message_to_sign ?? prepareData.tx_id;
        const signature = signTransaction(privateKey, messageToSign);
        return {
          ...input,
          signature,
        };
      });

      // 3. Clear private key immediately
      privateKey = '';

      // 4. Submit
      const res = await submitTransaction({
        body: {
          tx_id: prepareData.tx_id,
          inputs: signedInputs,
          outputs: prepareData.outputs,
          fee: prepareData.fee,
        },
      });

      if (res.error) {
        const errDetail = (res.error as { detail?: string }).detail;
        setSignError(errDetail ?? 'Failed to submit transaction.');
        return;
      }

      setSubmittedTxId(prepareData.tx_id);
      setStep('submitted');
      addToast('Transaction submitted', 'success');
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setSigning(false);
    }
  };

  const resetToCompose = () => {
    setStep('compose');
    setToAddress('');
    setAmount('');
    setFee('0');
    setComposeError('');
    setPrepareData(null);
    setPassword('');
    setSignError('');
    setSubmittedTxId('');
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3rem)] pb-10">
      <div className="w-full max-w-lg -mt-10">
        <div className="bg-[#202020] rounded-[2rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          {/* ============ STEP 1: COMPOSE ============ */}
          {step === 'compose' && (
            <>
              <h2 className="text-display text-3xl mb-6">Send Transaction</h2>

              <div className="flex flex-col gap-4">
                {/* From selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-base text-[--color-text-secondary]">From</label>
                  <select
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                    className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-base px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] appearance-none cursor-pointer transition-colors"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b95a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '36px',
                    }}
                  >
                    {profiles.length === 0 && (
                      <option value="" disabled>No saved wallets</option>
                    )}
                    {profiles.map((p) => (
                      <option key={p.address} value={p.address}>
                        {p.username} — {p.address.slice(0, 8)}…{p.address.slice(-6)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* To */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-base text-[--color-text-secondary]">Recipient Address</label>
                  <input
                    type="text"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    placeholder="Enter recipient address"
                    className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-base px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] transition-colors"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-base text-[--color-text-secondary]">
                    Amount ({coinName})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.000"
                    className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-base px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] transition-colors"
                  />
                  {amount && !isNaN(parseFloat(amount)) && (
                    <span className="text-sm text-[--color-text-tertiary]">
                      = {toAtomic(parseFloat(amount)).toLocaleString()} {coinName === 'Piper' ? 'Pips' : 'units'}
                    </span>
                  )}
                </div>

                {/* Fee */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-base text-[--color-text-secondary]">
                    Fee ({coinName})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="0"
                    className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-base px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] transition-colors"
                  />
                  <span className="text-sm text-[--color-text-tertiary]">
                    Higher fees are prioritized by miners.
                  </span>
                </div>

                {composeError && (
                  <p className="text-sm text-[--color-danger]">{composeError}</p>
                )}

                <button
                  onClick={handlePreview}
                  disabled={composing}
                  className="bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-base font-bold hover:bg-[#333333] transition-colors disabled:opacity-50 mt-2"
                >
                  {composing ? 'Preparing…' : 'Preview Transaction'}
                </button>
              </div>
            </>
          )}

          {/* ============ STEP 2: REVIEW & SIGN ============ */}
          {step === 'review' && prepareData && (
            <>
              <h2 className="text-display text-3xl mb-6">Review & Sign</h2>

              {/* Summary card */}
              <div className="bg-[#2a2a2a] rounded-lg p-5 flex flex-col gap-4 mb-5 shadow-inner">
                <div className="flex justify-between text-base">
                  <span className="text-[--color-text-secondary]">From</span>
                  <span className="text-[--color-text-primary]">
                    {fromProfile?.username}{' '}
                    <TruncatedAddress address={fromAddress} className="!text-[11px] !text-[--color-text-tertiary]" />
                  </span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-[--color-text-secondary]">To</span>
                  <TruncatedAddress address={toAddress} className="!text-[--color-text-primary]" />
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-[--color-text-secondary]">Amount</span>
                  <span className="text-[--color-text-primary]">{format(prepareData.outputs.reduce((s, o) => s + o.amount, 0) - (prepareData.outputs.length > 1 ? prepareData.outputs[prepareData.outputs.length - 1].amount : 0))}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-[--color-text-secondary]">Fee</span>
                  <span className="text-[--color-text-primary]">{format(prepareData.fee)}</span>
                </div>
                <div className="border-t border-[--color-surface-border] pt-3 flex justify-between text-base font-medium">
                  <span className="text-[--color-text-secondary]">Total deducted</span>
                  <span className="text-[--color-text-primary]">
                    {format(
                      prepareData.outputs.reduce((s, o) => s + o.amount, 0) -
                      (prepareData.outputs.length > 1 ? prepareData.outputs[prepareData.outputs.length - 1].amount : 0) +
                      prepareData.fee,
                    )}
                  </span>
                </div>
              </div>

              {/* Inputs to sign */}
              <div className="flex flex-col gap-2 mb-5">
                <span className="text-base text-[--color-text-secondary]">Inputs to sign</span>
                {prepareData.inputs.map((input, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-[#2a2a2a] rounded-lg px-4 py-3"
                  >
                    <span className="text-mono-sm" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      Input: {input.ref_tx_id.slice(0, 12)}…:{input.ref_output_index}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[--color-warning-ghost] text-[--color-warning]">
                      Pending signature
                    </span>
                  </div>
                ))}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5 mb-4 mt-2">
                <label className="text-base text-[--color-text-secondary]">
                  Enter your password to sign and send
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="bg-[#2a2a2a] rounded-lg text-[--color-text-primary] text-base px-4 py-3 outline-none focus:ring-2 focus:ring-[--color-accent-border] placeholder:text-[--color-text-tertiary] transition-colors"
                />
              </div>

              {signError && <p className="text-sm text-[--color-danger] mb-3">{signError}</p>}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setStep('compose');
                    setPassword('');
                    setSignError('');
                  }}
                  className="px-4 py-3 text-base text-[--color-text-secondary] hover:bg-[#2a2a2a] rounded-lg transition-colors font-medium"
                >
                  <ArrowLeft size={16} className="inline mr-1" />
                  Back
                </button>
                <button
                  onClick={handleSignAndSubmit}
                  disabled={signing}
                  className="flex-1 bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-base font-bold hover:bg-[#333333] transition-colors disabled:opacity-50"
                >
                  {signing ? 'Signing…' : 'Sign & Submit'}
                </button>
              </div>
            </>
          )}

          {/* ============ STEP 3: SUBMITTED ============ */}
          {step === 'submitted' && (
            <div className="flex flex-col items-center py-4 gap-4">
              <CheckCircle size={56} className="text-[--color-success]" />
              <h2 className="text-display text-3xl mb-2">Transaction submitted</h2>

              <div className="w-full bg-[#2a2a2a] rounded-lg p-4">
                <span
                  className="text-[12px] text-[--color-text-secondary] break-all block"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {submittedTxId}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <a
                  href="/blockchain"
                  className="text-base text-[--color-text-secondary] hover:bg-[#2a2a2a] px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  View in explorer
                </a>
                <button
                  onClick={resetToCompose}
                  className="bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-base font-bold hover:bg-[#333333] transition-colors"
                >
                  Send another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
