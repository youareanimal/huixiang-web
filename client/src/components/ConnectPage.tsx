import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Input, Tabs, Toast } from '@douyinfe/semi-ui';
import { IconGlobe, IconKey, IconLock, IconServer, IconUser } from '@douyinfe/semi-icons';
import { accountErrorText } from '../account';
import {
  effectiveNickname,
  store,
  type AccountState,
  type Bookmark,
  type BookmarksMessage,
  type ConnectOptions,
} from '../protocol';
import UserAvatar from './UserAvatar';
import PeekGuard from './PeekGuard';

/** 从用户输入里拿地址和端口：支持 `host`、`host:port`、`[v6]:port`，也认 ts3server:// 邀请开头。 */
function parseAddress(raw: string): { host: string; port: number } | null {
  const cleaned = raw.trim().replace(/^(ts3server|teamspeak|ts3s):\/\//i, '');
  if (!cleaned) return null;
  const bare = cleaned.split('?')[0];
  const v6 = bare.match(/^\[([^\]]+)\](?::(\d+))?$/);
  const plain = bare.match(/^([^:\s]+)(?::(\d+))?$/);
  const m = v6 ?? plain;
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : 9987;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: m[1], port };
}

interface Props {
  tokenNeeded: boolean;
  token: string;
  onTokenChange: (v: string) => void;
  connecting: boolean;
  error: string | null;
  account: AccountState;
  bookmarks: BookmarksMessage;
  onConnect: (opts: ConnectOptions) => void;
  onDismissError: () => void;
  onAccountLogin: (email: string, password: string, otp: string) => void;
  onAccountLogout: () => void;
  onAccountRefresh: () => void;
}

const inputStyle = { height: 48 };

/** 密码类输入框右侧的眼睛按钮：睁眼=明文，闭眼（带斜杠）=已遮挡 */
function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <Button
      htmlType="button"
      className="login-reveal btn-semi"
      aria-label={shown ? '隐藏' : '显示'}
      title={shown ? '隐藏' : '显示'}
      onClick={onToggle}
      onMouseDown={(e) => e.preventDefault()}
    >
      {shown ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.4 19.6 19.6 4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </Button>
  );
}

/** 底部「其他登录方式」的三个入口：图标都是手写的，Semi 图标库里没有对应款 */
const SOCIALS = [
  {
    id: 'wechat',
    label: '微信登录',
    icon: (
      <svg className="login-social-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9.2 4.4c-3.5 0-6.4 2.3-6.4 5.2 0 1.6.9 3.1 2.4 4.1l-.6 2 2.2-1.1c.8.2 1.6.3 2.4.3h.5a5 5 0 0 1-.2-1.4c0-3 2.9-5.3 6.5-5.3h.4c-.5-2.2-3.1-3.8-6.2-3.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M21.2 13.1c0-2.4-2.4-4.3-5.3-4.3s-5.3 1.9-5.3 4.3 2.4 4.3 5.3 4.3c.6 0 1.3-.1 1.9-.3l1.8.9-.5-1.6c1.3-.8 2.1-2 2.1-3.3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'qq',
    label: 'QQ 登录',
    icon: (
      <svg className="login-social-icon" viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="13.6" rx="5.1" ry="7.5" fill="currentColor" />
        <ellipse cx="12" cy="15.9" rx="3.05" ry="4" fill="#fff" />
        <circle cx="10.1" cy="9.6" r="1.5" fill="#fff" />
        <circle cx="13.9" cy="9.6" r="1.5" fill="#fff" />
        <circle cx="10.1" cy="9.8" r="0.6" fill="currentColor" />
        <circle cx="13.9" cy="9.8" r="0.6" fill="currentColor" />
        <path d="M11.1 12.1h1.8l-.9 1.5z" fill="#fff" />
        <ellipse cx="9.7" cy="21" rx="1.7" ry="0.85" fill="currentColor" />
        <ellipse cx="14.3" cy="21" rx="1.7" ry="0.85" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'GitHub 登录',
    icon: (
      <svg className="login-social-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-1.9c-3.12.68-3.78-1.5-3.78-1.5-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.49-.29-5.1-1.25-5.1-5.55 0-1.23.43-2.23 1.15-3.02-.12-.29-.5-1.43.11-2.98 0 0 .94-.3 3.1 1.15a10.7 10.7 0 0 1 5.64 0c2.16-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.98.72.79 1.15 1.79 1.15 3.02 0 4.31-2.62 5.26-5.12 5.54.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

// 退出服务器会重新挂载这个组件：地址留一份在模块里，免得每次退回来都得重填
// （协议勾选走 localStorage，刷新浏览器也还在）
let lastAddress = '';

/** 两个页签：登录 myTeamSpeak 账号，或者干脆当游客 */
type Mode = 'account' | 'guest';

export default function ConnectPage({
  tokenNeeded,
  token,
  onTokenChange,
  connecting,
  error,
  account,
  bookmarks,
  onConnect,
  onDismissError,
  onAccountLogin,
  onAccountLogout,
  onAccountRefresh,
}: Props) {
  const [address, setAddressState] = useState(lastAddress);
  const setAddress = (next: string) => {
    lastAddress = next;
    setAddressState(next);
  };
  const [nickname, setNickname] = useState(() => store.nickname());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountEmail, setAccountEmail] = useState(() => store.accountLogin()?.email ?? '');
  const [accountPassword, setAccountPassword] = useState(() => store.accountLogin()?.password ?? '');
  const [remember, setRemember] = useState(() => store.accountLogin() !== null);
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [agreed, setAgreedState] = useState(() => store.agreed());
  const setAgreed = (next: boolean) => {
    setAgreedState(next);
    store.setAgreed(next);
  };
  // 一进来就停在 MyTeamSpeak 登录（要游客登录再点页签），符合「默认打开即是登录页」
  const [mode, setMode] = useState<Mode>('account');
  // 捂眼：只要光标落在密码类输入框里，右边的小家伙就集体避开视线
  const [hiding, setHiding] = useState(false);
  const recent = useMemo(() => store.recent(), []);
  const parsed = parseAddress(address);
  // 网关刚退出登录时会推一条「已登录但没名字」的中间态，别拿它当登录成功
  const signedIn = account.phase === 'signedIn' && !!(account.username || account.email);
  // 账号登录取账号名；游客登录始终用用户自己填的昵称，哪怕已登录 myTeamSpeak
  const nick = mode === 'guest' ? nickname : effectiveNickname(account, nickname);
  const identityChoices = account.identities ?? [];
  const matchingIdentities = identityChoices.filter((entry) => /^default$/i.test(entry.name));
  const cloudIdentityReady = !signedIn || (!account.identitiesLoading && !account.identitiesError && matchingIdentities.length === 1);
  const canConnect = !!parsed && nick.trim().length > 0 && (!tokenNeeded || token.trim().length > 0) && agreed && cloudIdentityReady;
  const accountBusy = account.phase === 'busy';
  // 账号页签只填账号、密码、口令（要网关口令的话），协议勾上就能点「登录」；
  // 服务器地址和服务器密码留到登录后的中间页再填，那里还能挑云书签。
  const canLogin =
    !!accountEmail.trim() &&
    accountPassword.length > 0 &&
    (!tokenNeeded || token.trim().length > 0) &&
    !accountBusy &&
    agreed;

  const peek = () => setHiding(true);
  const uncover = () => setHiding(false);

  // 只有一个地址时进页面直接填上，省一次输入。
  // 只在首次填充，之后用户删掉就是删掉——不能「地址一空就补回来」，否则永远删不掉。
  const autoFilled = useRef(false);
  useEffect(() => {
    if (autoFilled.current) return;
    if (recent.length === 1 && !address) {
      autoFilled.current = true;
      setAddress(recent[0]);
    }
  }, [recent, address]);

  // 需要两步验证时，网关会说 208/209；把验证码输入框露出来。
  useEffect(() => {
    if (account.error === 'MYTS_208' || account.error === 'MYTS_209') setShowOtp(true);
  }, [account.error]);

  // 连服务器失败（口令错、地址不通…）：用和「功能开发中」一样的 Toast 提示
  const lastError = useRef<string | null>(null);
  useEffect(() => {
    if (!error) {
      lastError.current = null;
      return;
    }
    if (lastError.current === error) return;
    lastError.current = error;
    Toast.error({ content: error, duration: 4 });
    onDismissError();
  }, [error, onDismissError]);

  // 账号密码错、两步验证码错：同样走 Toast
  const lastAccountError = useRef<string | null>(null);
  useEffect(() => {
    if (!account.error) {
      lastAccountError.current = null;
      return;
    }
    if (lastAccountError.current === account.error) return;
    lastAccountError.current = account.error;
    Toast.error({ content: accountErrorText(account.error), duration: 4 });
  }, [account.error]);

  // 记住密码：登录成功后按勾选状态写入/清除本地
  const rememberRef = useRef(remember);
  rememberRef.current = remember;
  const emailRef = useRef(accountEmail);
  emailRef.current = accountEmail;
  const accountPwdRef = useRef(accountPassword);
  accountPwdRef.current = accountPassword;
  useEffect(() => {
    if (account.phase !== 'signedIn') return;
    if (rememberRef.current && emailRef.current.trim()) {
      store.setAccountLogin({ email: emailRef.current.trim(), password: accountPwdRef.current });
    }
  }, [account.phase]);

  const toggleRemember = (next: boolean) => {
    setRemember(next);
    if (!next) store.setAccountLogin(null);
  };

  // 点云书签：把地址/昵称/服务器密码一次性填进中间页的表单
  const applyBookmark = (bookmark: Bookmark) => {
    setAddress(bookmark.address);
    setNickname(bookmark.nickname.trim() || account.username || nickname);
    setPassword(bookmark.password);
    if (bookmark.password) setShowPassword(true);
    Toast.info({ content: bookmark.password ? '已填入云书签，含服务器密码' : '已填入云书签', duration: 2 });
  };

  const submit = () => {
    if (!parsed || !canConnect) return;
    lastError.current = null;
    onConnect({
      host: parsed.host,
      port: parsed.port,
      nickname: nick.trim(),
      password,
      identity: store.identity(),
      guest: mode === 'guest',
    });
  };

  // 点「登录」：先弹「正在登录…」，验完 myTeamSpeak 账号就停在中间页（云书签 + 地址 + 服务器密码）
  const [loggingIn, setLoggingIn] = useState(false);
  const loggingInRef = useRef(false);
  const closeLoginToast = () => Toast.close('login-pending');

  useEffect(() => {
    if (!loggingInRef.current) return;
    // 登录尝试到此结束就该复位：账号登录成功（signedIn）、myTeamSpeak 报错（account.error），
    // 或者网关这层先失败了（比如网关口令不对，error 有值）。不带上 error 的话，口令错误时
    // 不会产生 account.error，按钮会一直「正在登录…」直到 15 秒兜底，看着就像卡死。
    if (signedIn || account.error || error) {
      loggingInRef.current = false;
      setLoggingIn(false);
      closeLoginToast();
    }
  }, [signedIn, account, error]);

  const submitLogin = () => {
    if (signedIn) {
      submit();
      return;
    }
    if (!canLogin) return;
    lastAccountError.current = null;
    lastError.current = null;
    loggingInRef.current = true;
    setLoggingIn(true);
    Toast.info({ id: 'login-pending', content: '正在登录…', duration: 10 });
    // 兜底：网关没回话（比如网关口令不对，连网关都开不起来）也别让按钮一直转
    window.setTimeout(() => {
      if (!loggingInRef.current) return;
      loggingInRef.current = false;
      setLoggingIn(false);
      closeLoginToast();
    }, 15000);
    onAccountLogin(accountEmail.trim(), accountPassword, otp.trim());
  };

  // 服务器地址 + 口令，两个页签都要用，提出来省得抄一遍
  const addressField = (
    <>
      <Input
        id="addr"
        size="large"
        style={inputStyle}
        prefix={<IconGlobe />}
        placeholder="请输入服务器地址"
        value={address}
        onChange={setAddress}
        onEnterPress={submit}
        showClear
      />
      {address && !parsed && <span className="field-error">地址看不懂，端口要 1–65535</span>}
    </>
  );

  const middlePasswordField = (
    <Input
      id="server-pwd"
      size="large"
      style={inputStyle}
      prefix={<IconKey />}
      type={showPassword ? 'text' : 'password'}
      placeholder="请输入服务器密码，没有就留空"
      value={password}
      onChange={setPassword}
      onEnterPress={submit}
      onFocus={peek}
      onBlur={uncover}
      suffix={<RevealButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
    />
  );

  // 登录页的第三个框就是网关的访问口令（站主给的那串），服务器密码留到中间页再填
  const gatewayTokenField = (
    <Input
      id="token"
      size="large"
      style={inputStyle}
      prefix={<IconServer />}
      placeholder="请输入网关访问口令"
      value={token}
      onChange={(v) => {
        // 网关口令是站主定死的值，填过一次就留在本地，下次打开直接带出来
        onTokenChange(v);
        store.setToken(v);
      }}
      onEnterPress={submitLogin}
      onFocus={peek}
      onBlur={uncover}
    />
  );

  const tokenField = tokenNeeded ? (
    <div className="login-field">
      <Input
        id="token"
        size="large"
        style={inputStyle}
        prefix={<IconServer />}
        placeholder="请输入网关访问口令"
        value={token}
        onChange={(v) => {
          // 和登录页一样：站主定死的口令填一次就留在本地，下次打开直接带出来
          onTokenChange(v);
          store.setToken(v);
        }}
        onEnterPress={submit}
        onFocus={peek}
        onBlur={uncover}
      />
    </div>
  ) : null;

  // 设计稿里「最近连过」是这个页签的固定一块，没有历史时给一句空态，不留白
  const recentBlock = (
    <div className="recent">
      <span className="recent-label">最近连过</span>
      {recent.length > 0 ? (
        <div className="recent-list">
          {recent.map((r) => (
            <Button key={r} htmlType="button" className="recent-item btn-semi" onClick={() => setAddress(r)}>
              <IconServer size="small" />
              <span>{r}</span>
            </Button>
          ))}
        </div>
      ) : (
        <span className="login-hint">连过一次之后，这里会留下记录，点一下就能回到那台服务器。</span>
      )}
    </div>
  );

  return (
    <div className="login-shell">
      <div className="login-panel">
        <section className="login-form-side">
          <div className="login-form">
            {/* 窄屏没有右侧面板，品牌信息挪到这里 */}
            <div className="login-mobile-brand">
              <img className="brand-mark" src="/icons/icon-96.png" alt="" aria-hidden="true" />
              <span className="brand-name">回响</span>
            </div>

            <Tabs
              className="login-tabs"
              type="button"
              activeKey={mode}
              onChange={(key) => setMode(key as 'account' | 'guest')}
              tabList={[
                { itemKey: 'account', tab: 'MyTeamSpeak 登录' },
                { itemKey: 'guest', tab: '游客登录' },
              ]}
            />

            <h1 className="login-title">
              {mode === 'account' ? (signedIn ? '选择服务器' : 'MyTeamSpeak 登录') : '游客登录'}
            </h1>

            {mode === 'account' ? (
              <>
                {signedIn && (
                  <div className="login-account">
                    <UserAvatar
                      name={account.username || account.email}
                      sources={account.avatarUrl ? [account.avatarUrl] : []}
                      colorKey={account.username || account.email}
                      className="account-avatar"
                      label={`${account.username} 的头像`}
                    />
                    <div className="login-account-id">
                      <span className="login-account-name">{account.username || 'myTeamSpeak 账号'}</span>
                      <span className="login-account-sub">{account.email || '已登录'}</span>
                    </div>
                    <div className="login-account-links">
                      <Button htmlType="button" className="field-link btn-semi" onClick={onAccountRefresh}>
                        刷新
                      </Button>
                      <Button htmlType="button" className="field-link btn-semi" onClick={onAccountLogout}>
                        切换账号
                      </Button>
                    </div>
                  </div>
                )}

                {!signedIn && (
                  <>
                    <div className="login-field">
                      <Input
                        id="account-email"
                        size="large"
                        style={inputStyle}
                        prefix={<IconUser />}
                        placeholder="请输入账号"
                        value={accountEmail}
                        onChange={setAccountEmail}
                        onEnterPress={submitLogin}
                        disabled={accountBusy || loggingIn}
                      />
                    </div>
                    <div className="login-field">
                      <Input
                        id="account-password"
                        size="large"
                        style={inputStyle}
                        prefix={<IconLock />}
                        type={showAccountPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        value={accountPassword}
                        onChange={setAccountPassword}
                        onEnterPress={submitLogin}
                        onFocus={peek}
                        onBlur={uncover}
                        disabled={accountBusy || loggingIn}
                        suffix={
                          <RevealButton
                            shown={showAccountPassword}
                            onToggle={() => setShowAccountPassword((v) => !v)}
                          />
                        }
                      />
                    </div>
                    <div className="login-field">{gatewayTokenField}</div>

                    {showOtp ? (
                      <>
                        <div className="login-field">
                          <Input
                            id="account-otp"
                            size="large"
                            style={inputStyle}
                            prefix={<IconKey />}
                            placeholder="两步验证码"
                            value={otp}
                            onChange={setOtp}
                            onEnterPress={submitLogin}
                            onFocus={peek}
                            onBlur={uncover}
                            disabled={accountBusy || loggingIn}
                            maxLength={64}
                          />
                        </div>
                        <Checkbox
                          className="login-remember"
                          checked={remember}
                          onChange={(e) => toggleRemember(!!e.target.checked)}
                        >
                          记住密码
                        </Checkbox>
                      </>
                    ) : (
                      // 没展开两步验证时，验证入口和「记住密码」并排一行
                      <div className="login-extras">
                        <Button htmlType="button" className="field-link login-otp-link btn-semi" onClick={() => setShowOtp(true)}>
                          账号开启了两步验证？
                        </Button>
                        <Checkbox
                          className="login-remember"
                          checked={remember}
                          onChange={(e) => toggleRemember(!!e.target.checked)}
                        >
                          记住密码
                        </Checkbox>
                      </div>
                    )}

                    <Button
                      htmlType="button"
                      className="login-submit btn-semi"
                      disabled={!canLogin || loggingIn}
                      onClick={submitLogin}
                    >
                      {loggingIn ? '正在登录…' : '登录'}
                    </Button>
                  </>
                )}

                {signedIn && (
                  <>
                    <div className="login-field">
                      <label>账号身份</label>
                      {account.identitiesLoading ? <span className="login-hint">正在同步身份…</span> : account.identitiesError ?
                        <span className="field-error">身份同步失败，请刷新或重新登录（{account.identitiesError}）</span> :
                        matchingIdentities.length !== 1 ? <span className="field-error">账号中没有唯一的 default 同步身份，请检查官方客户端中的身份名称和同步状态。</span> :
                        <span className="login-hint">自动使用 default 同步身份，不区分大小写</span>}
                    </div>
                    <div className="login-bookmarks">
                      <div className="login-bookmarks-head">
                        <span>云书签</span>
                        <span className="login-bookmarks-count">
                          {bookmarks.loading ? '同步中…' : `${bookmarks.items.length} 个`}
                        </span>
                      </div>
                      {bookmarks.error ? (
                        <span className="field-error">{accountErrorText(bookmarks.error)}</span>
                      ) : bookmarks.items.length === 0 && !bookmarks.loading ? (
                        <span className="login-hint">这个账号还没有保存服务器书签。</span>
                      ) : (
                        <div className="saved-list">
                          {bookmarks.items.map((bookmark) => (
                            <Button
                              key={bookmark.id}
                              htmlType="button"
                              className="saved-item btn-semi"
                              onClick={() => applyBookmark(bookmark)}
                              title={`填入 ${bookmark.address}`}
                            >
                              <IconServer size="small" />
                              <span className="saved-main">
                                <span className="saved-name">{bookmark.name || bookmark.address}</span>
                                <span className="saved-sub">{bookmark.address}</span>
                              </span>
                              {bookmark.password && (
                                <span className="saved-key" title="云书签里有服务器密码，填入后自动使用">
                                  <IconKey size="small" />
                                </span>
                              )}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="login-field">{addressField}</div>
                    <div className="login-field">{middlePasswordField}</div>

                    <Button
                      htmlType="button"
                      className="login-submit btn-semi"
                      disabled={!canConnect || connecting}
                      onClick={submit}
                    >
                      {connecting ? '正在进入服务器…' : `以 ${account.username || account.email} 身份进入服务器`}
                    </Button>
                  </>
                )}

              </>
            ) : (
              <>
                <div className="login-field">
                  <Input
                    id="nick"
                    size="large"
                    style={inputStyle}
                    prefix={<IconUser />}
                    placeholder="别人看到的名字"
                    value={nick}
                    onChange={setNickname}
                    onEnterPress={submit}
                    maxLength={30}
                  />
                </div>

                <div className="login-field">{addressField}</div>
                <div className="login-field">{middlePasswordField}</div>
                {tokenField}

                <Button htmlType="button" className="login-submit btn-semi" disabled={!canConnect || connecting} onClick={submit}>
                  {connecting ? '正在连接…' : '以游客身份进入'}
                </Button>
              </>
            )}

            <Checkbox
              className="login-agree"
              checked={agreed}
              onChange={(e) => {
                setAgreed(!!e.target.checked);
              }}
            >
              <span>
                我已阅读并同意 <b>用户服务协议</b> 和 <b>隐私政策</b>
              </span>
            </Checkbox>

            {mode === 'guest' && recentBlock}

            {mode === 'account' && (
              <>
                <div className="login-others">
                  <span className="login-others-line" />
                  <span className="login-others-text">其他登录方式</span>
                  <span className="login-others-line" />
                </div>
                <div className="login-socials">
                  {SOCIALS.map((social) => (
                    <Button
                      key={social.id}
                      htmlType="button"
                      className="login-social btn-semi"
                      onClick={() => Toast.info({ content: '该功能正在开发中，敬请期待', duration: 2.5 })}
                    >
                      {social.icon}
                      {social.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="login-brand-side">
          <PeekGuard guard={hiding} />
          <div className="login-brand">
            <img className="brand-mark" src="/icons/icon-96.png" alt="" aria-hidden="true" />
            <div className="brand-text">
              <span className="brand-name">回响</span>
              <span className="brand-sub">网页版 · 不必安装，推门即入</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
