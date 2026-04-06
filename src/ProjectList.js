import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

function ProjectList({ onSelect }) {
  const [projects,     setProjects]     = useState([]);
  const [showNew,      setShowNew]      = useState(false);
  const [region,       setRegion]       = useState('');
  const [name,         setName]         = useState('');
  // 복사 모달 상태
  const [copyTarget,   setCopyTarget]   = useState(null);
  const [copySubmitTo, setCopySubmitTo] = useState('');
  const [copying,      setCopying]      = useState(false);

  const load = async () => {
    const snap = await getDocs(collection(db, 'projects'));
    const list = snap.docs.map(d => {
      const { id: _ignored, ...rest } = d.data();
      const docId = d.id;
      return {
        id:       docId,
        name:     rest.name     || docId,
        region:   rest.region   || '',
        submitTo: rest.submitTo || '',
        ...rest,
      };
    });
    list.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    setProjects(list);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!region.trim() || !name.trim()) return alert('지역과 프로젝트명을 입력하세요');
    const isDup = projects.some(p => p.region === region.trim() && p.name === name.trim());
    if (isDup) return alert('동일한 지역과 프로젝트명이 이미 존재합니다');
    await addDoc(collection(db, 'projects'), {
      region: region.trim(), name: name.trim(),
      createdAt: Date.now(),
    });
    setRegion(''); setName(''); setShowNew(false);
    load();
  };

  const remove = async (docId) => {
    if (!window.confirm('프로젝트를 삭제하시겠습니까?\n(모든 입력 데이터가 함께 삭제됩니다)')) return;
    const sheetsSnap = await getDocs(collection(db, 'projects', docId, 'sheets'));
    await Promise.all(sheetsSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'projects', docId));
    load();
  };

  // ── 버전 복사 ──
  const copyProject = async () => {
    if (!copyTarget) return;
    if (!copySubmitTo.trim()) return alert('제출처를 입력하세요');
    setCopying(true);
    try {
      // 1. 새 프로젝트 doc 생성
      const newDocRef = await addDoc(collection(db, 'projects'), {
        region:    copyTarget.region,
        name:      copyTarget.name,
        submitTo:  copySubmitTo.trim(),
        createdAt: Date.now(),
      });

      // 2. 원본 sheets 전체 복사 + 건축개요에 제출처 자동 입력
      const sheetsSnap = await getDocs(collection(db, 'projects', copyTarget.id, 'sheets'));
      for (const sheetDoc of sheetsSnap.docs) {
        const sheetData = sheetDoc.data();
        const newData = sheetDoc.id === '건축개요'
          ? { ...sheetData, submitTo: copySubmitTo.trim() }
          : { ...sheetData };
        await setDoc(doc(db, 'projects', newDocRef.id, 'sheets', sheetDoc.id), newData);
      }

      setCopyTarget(null);
      setCopySubmitTo('');
      load();
      alert(`✅ "${copyTarget.name} - ${copySubmitTo.trim()}" 버전이 생성됐습니다`);
    } catch (e) {
      alert('복사 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <h2 style={{ color: '#2c3e50', marginBottom: '8px' }}>부동산 프로젝트 관리</h2>
      <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>검토 중인 프로젝트를 선택하세요</p>

      <button onClick={() => setShowNew(!showNew)}
        style={{ padding: '10px 20px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '16px' }}>
        + 새 프로젝트 만들기
      </button>

      {showNew && (
        <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="지역 (예: 부산 남구)" value={region}
              onChange={e => setRegion(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', width: '200px' }} />
            <input placeholder="프로젝트명 (예: 대연동 주상복합)" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', width: '260px' }} />
            <button onClick={create}
              style={{ padding: '8px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>생성</button>
            <button onClick={() => { setShowNew(false); setRegion(''); setName(''); }}
              style={{ padding: '8px 16px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {/* 복사 모달 */}
      {copyTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', width: '460px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', color: '#2c3e50' }}>📋 버전 복사</h3>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 20px' }}>원본 데이터를 그대로 복사하여 새 버전을 만듭니다</p>

            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#2c3e50' }}>{p.region ? `${p.region} ${p.name}` : p.name}</span>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>원본</div>
              <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{copyTarget.name}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{copyTarget.region}</div>
            </div>

            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '6px' }}>
              제출처 <span style={{ color: '#e74c3c' }}>*</span>
              <span style={{ fontWeight: 'normal', color: '#aaa', marginLeft: '8px' }}>(예: 신한은행, KB국민은행)</span>
            </label>
            <input
              value={copySubmitTo}
              onChange={e => setCopySubmitTo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && copyProject()}
              placeholder="제출처를 입력하세요"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            />
            {copySubmitTo.trim() && (
              <div style={{ fontSize: '12px', color: '#27ae60', marginTop: '8px' }}>
                → 생성될 버전: <strong>{copyTarget.name} - {copySubmitTo.trim()}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => { setCopyTarget(null); setCopySubmitTo(''); }}
                style={{ padding: '9px 20px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={copyProject} disabled={copying}
                style={{ padding: '9px 24px', backgroundColor: copying ? '#aaa' : '#e67e22', color: 'white', border: 'none', borderRadius: '6px', cursor: copying ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {copying ? '복사 중...' : '📋 복사 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '60px 0', fontSize: '15px' }}>
          프로젝트가 없습니다. 새 프로젝트를 만들어보세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {projects.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#2c3e50' }}>{p.name}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px',
                    backgroundColor: !p.submitTo ? '#eafaf1' : '#fdedec',
                    color: !p.submitTo ? '#27ae60' : '#c0392b',
                    border: `1px solid ${!p.submitTo ? '#a9dfbf' : '#f5b7b1'}`,
                  }}>
                    {!p.submitTo ? '📁 원본' : `📤 ${p.submitTo}`}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  {p.createdAt ? new Date(Number(p.createdAt)).toLocaleDateString('ko-KR') : '날짜 없음'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => onSelect(p)}
                  style={{ padding: '7px 18px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  열기
                </button>
                <button onClick={() => { setCopyTarget(p); setCopySubmitTo(''); }}
                  style={{ padding: '7px 14px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                  📋 복사
                </button>
                <button onClick={() => remove(p.id)}
                  style={{ padding: '7px 12px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectList;
