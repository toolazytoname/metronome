#!/usr/bin/env python3
"""App-only, non-destructive, opt-in physical-iPhone UI checks. Requires an unlocked phone.

No volume/silent-switch changes, purchases, recording, or system screenshots.
PASS_UI_STATE does not mean audible timing, background audio, or StoreKit PASS.
"""
import urllib.request, urllib.error, json, time, pathlib, xml.etree.ElementTree as ET
import argparse, signal
parser = argparse.ArgumentParser(description="Opt-in iOS UI-state checks through an already-running, signed WDA runner. Not an audio/IAP acceptance test.")
parser.add_argument('--output', type=pathlib.Path, required=True, help='New evidence directory; never overwritten')
parser.add_argument('--wda-url', default='http://127.0.0.1:18100')
parser.add_argument('--smoke-only', action='store_true', help='Skip the three 60-second holds; never count as timing acceptance')
args = parser.parse_args()
ROOT = args.output
ROOT.mkdir(parents=True, exist_ok=False)
WDA_URL = args.wda_url.rstrip('/')
if not WDA_URL.startswith(('http://127.0.0.1:', 'http://localhost:')):
    parser.error('Use a local USB relay endpoint, not a public WDA server')
BUNDLE='studio.weichao.jpq'
def req(path,body=None,method=None):
    data=None if body is None else json.dumps(body).encode()
    r=urllib.request.Request(WDA_URL+path,data=data,method=method,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(r,timeout=25) as s: ans=json.load(s)
    except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
    v=ans.get('value')
    if isinstance(v,dict) and v.get('error'):raise RuntimeError(v)
    return ans
class App:
    def __init__(self):
        self.sid=SESSION_ID
    def call(self,path,body=None,method=None):return req('/session/'+self.sid+path,body,method)['value']
    def foreground(self):
        state=self.call('/wda/apps/state',{'bundleId':BUNDLE})
        if state!=4:raise RuntimeError('App not foreground: '+str(state))
    def tree(self,label):
        self.foreground()
        s=self.call('/source?format=xml')
        self.foreground()
        t=ET.fromstring(s)
        # Reject system-app trees; never take whole-device screenshots.
        apps=[n for n in t.iter('XCUIElementTypeApplication')]
        if len(apps)!=1 or apps[0].get('bundleId')!=BUNDLE:raise RuntimeError('Unexpected app tree')
        (ROOT/(label+'-'+str(time.time_ns())+'.xml')).write_text(s)
        return t
    def element(self,label):
        self.foreground()
        v=self.call('/element',{'using':'predicate string','value':'type == "XCUIElementTypeButton" AND label == '+json.dumps(label,ensure_ascii=False)})
        return v.get('ELEMENT') or v['element-6066-11e4-a52e-4f735466cecf']
    def click(self,label):
        eid=self.element(label)
        return self.call('/element/'+eid+'/click',{})
    def names(self,t):return [n.get('label','') for n in t.iter() if n.get('visible')=='true']

import re, traceback
device = req('/wda/device/info')['value']
if device.get('isSimulator') is not False:
    raise RuntimeError('This acceptance script requires a physical iPhone')
(ROOT / 'device.json').write_text(json.dumps({'isSimulator': False, 'model': device.get('model')}, indent=2))
session = req('/session', {'capabilities': {'alwaysMatch': {
    'bundleId': BUNDLE, 'forceAppLaunch': False, 'shouldTerminateApp': False,
    'disableAutomaticScreenshots': True, 'waitForIdleTimeout': 0.5,
}}})
SESSION_ID = session.get('sessionId') or session['value']['sessionId']
app=App(); results=[];original=None

def deadline(signum, frame):
    raise TimeoutError('20-minute test deadline reached')
signal.signal(signal.SIGALRM, deadline)
signal.alarm(20 * 60)

def capture(label):
 t=app.tree(label);names=app.names(t)
 bpm=[int(m.group(1)) for n in names if (m:=re.fullmatch(r'(\d+) BPM',n))]
 if len(bpm)!=1:raise RuntimeError('Expected one BPM display')
 lang='zh' if '语言' in names else 'en' if 'Language' in names else None
 if not lang:raise RuntimeError('Language control missing')
 return {'bpm':bpm[0],'lang':lang,'playing':('暂停' if lang=='zh' else 'Pause') in names,'names':names}
def record(case,**fields):
 row={'case':case,'time':time.time(),**fields};results.append(row);print(row,flush=True)
 (ROOT/'result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
def set_bpm(target):
 before=capture('bpm-before'); current=before['bpm']; step=1 if target>current else -1
 if not 40<=target<=208:raise ValueError('range')
 for i in range(abs(target-current)):
  app.click('BPM +1' if step>0 else 'BPM -1')
  if (i+1)%10==0 or i==abs(target-current)-1:
   s=capture('bpm-step')
   if s['bpm']!=current+(i+1)*step:raise AssertionError(('BPM step mismatch',s['bpm']))
   if s['playing']!=before['playing']:raise AssertionError('Playback state changed while adjusting BPM')
 s=capture('bpm-exact');assert s['bpm']==target
 return s
def toggle(expect):
 s=capture('toggle-before');assert s['playing']!=expect
 app.click(('播放' if expect else '暂停') if s['lang']=='zh' else ('Play' if expect else 'Pause'))
 s=capture('toggle-after');assert s['playing']==expect
 expected=('正在播放' if expect else '待开始') if s['lang']=='zh' else ('Playing' if expect else 'Ready')
 assert any(n.startswith(expected+' · ') for n in s['names']),s['names']
 return s
try:
 original=capture('core-start');(ROOT/'original-ui.json').write_text(json.dumps(original,ensure_ascii=False,indent=2))
 if original['playing']:raise RuntimeError('App already playing at baseline; do not interrupt user session')
 toggle(True);time.sleep(2);toggle(False);record('single-play-pause',status='PASS_UI_STATE')
 for lang in ['en','zh']:
  s=capture('language-before')
  if s['lang']!=lang:app.click('语言' if s['lang']=='zh' else 'Language')
  s=capture('language-after');assert s['lang']==lang
  assert ('Play' if lang=='en' else '播放') in s['names']
  toggle(True);time.sleep(1);toggle(False)
  record('language-'+lang,status='PASS_UI_STATE',voice_audio='NOT_LISTENED')
 for target in ([] if args.smoke_only else [40,120,208]):
  set_bpm(target);toggle(True);start=time.monotonic()
  for mark in [15,30,45,60]:
   time.sleep(max(0,start+mark-time.monotonic()))
   s=capture('hold-'+str(target)+'-'+str(mark));assert s['bpm']==target and s['playing']
  elapsed=time.monotonic()-start;toggle(False)
  record('bpm-'+str(target)+'-60s',status='PASS_UI_STATE_ONLY',elapsed=elapsed,audible_timing='NOT_VERIFIED')
 set_bpm(120);toggle(True);set_bpm(121);toggle(False)
 record('bpm-change-playing',status='PASS_UI_STATE_ONLY',extra_beat='NOT_VERIFIED')
except Exception as e:
 record('execution',status='FAILED_OR_BLOCKED',error=str(e));traceback.print_exc()
finally:
 signal.alarm(180)  # Bound UI restoration separately from the test deadline.
 try:
  if original is not None and not original['playing']:
   s=capture('cleanup-start')
   if s['playing']:toggle(False)
   set_bpm(original['bpm'])
   s=capture('cleanup-lang')
   if s['lang']!=original['lang']:app.click('语言' if s['lang']=='zh' else 'Language')
   s=capture('cleanup-final');assert (s['bpm'],s['lang'],s['playing'])==(original['bpm'],original['lang'],False)
   record('restore-original-ui',status='PASS',bpm=s['bpm'],lang=s['lang'])
 except Exception as e:record('cleanup-restore',status='FAILED',error=str(e))
 finally:
  signal.alarm(0)
  if original is not None and not original['playing']:
   try:
    app.call('/wda/apps/terminate',{'bundleId':BUNDLE})
    assert app.call('/wda/apps/state',{'bundleId':BUNDLE})==1
    record('cleanup-terminate',status='PASS')
   except Exception as e:record('cleanup-terminate',status='FAILED',error=str(e))
  try: app.call('',method='DELETE')
  except Exception as e:record('session-cleanup',status='FAILED',error=str(e))

if args.smoke_only:
 record('three-60-second-holds',status='SKIPPED')

if any(r.get("status") in ("FAILED", "FAILED_OR_BLOCKED") for r in results):
 raise SystemExit(1)
