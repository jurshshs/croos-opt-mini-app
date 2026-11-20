import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, BadgePercent, Check, ChevronRight, Heart, House, LayoutGrid, Minus, Package, Plus, Search, Settings2, ShoppingBag, Trash2, UserRound, X, Crown, ImagePlus, LogOut, MapPin, Ruler, Truck } from 'lucide-react';
import { STORE_NAME } from './config';
import { seedProducts, categories, categoryName, money, read, write, demoOrders } from './data';
import './style.css';
import './motion.css';
import { formatChannelPost } from './channel-post';
import { publishProduct } from './publish-product';
import './admin.css';
import './refinement.css';

const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
const cleanTitle = p => p.title.split('(')[0].trim();
const displayImage = p => p?.images?.[0] || '';
const createOrderId = () => 'CR-' + Date.now().toString(36).toUpperCase();

function App() {
  const [splash, setSplash] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'intro');
  const [toast, setToast] = useState('');
  const [exitingCart, setExitingCart] = useState('');
  const touchStart = useRef(null);
  const [page, setPage] = useState('home');
  const [previous, setPrevious] = useState('home');
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState(() => read('products', seedProducts));
  const [cart, setCart] = useState(() => read('cart', []));
  const [orders, setOrders] = useState(() => read('orders', []));
  const [favorites, setFavorites] = useState(() => read('favorites', []));
  const [role, setRole] = useState(() => read('role', 'buyer'));
  const [category, setCategory] = useState('all');
  const [adminCategory, setAdminCategory] = useState('all');
  const [adminQuery, setAdminQuery] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [photo, setPhoto] = useState(0);
  const [size, setSize] = useState('');
  const [editor, setEditor] = useState(null);
  const savingProduct = useRef(false);
  const [completed, setCompleted] = useState(null);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState({ fullName: '', phone: '', city: '', branch: '', height: '', weight: '', shoeSizes: {} });
  useEffect(() => write('products', products), [products]);
  useEffect(() => write('cart', cart), [cart]);
  useEffect(() => write('orders', orders), [orders]);
  useEffect(() => write('favorites', favorites), [favorites]);
  useEffect(() => write('role', role), [role]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2300); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { if (tg?.BackButton) { if (['home','catalog','cart','profile'].includes(page)) tg.BackButton.hide(); else { tg.BackButton.show(); tg.BackButton.onClick(back); } return () => tg.BackButton.offClick(back); } }, [page, previous]);
  useEffect(() => { if (new URLSearchParams(location.search).get('view') === 'admin') { setRole('seller'); setPage('admin'); } }, []);
  const count = cart.reduce((n, x) => n + x.quantity, 0);
  const lines = cart.map(x => ({ ...x, product: products.find(p => p.id === x.id) })).filter(x => x.product);
  const total = lines.reduce((n, x) => n + (x.product.price || 0) * x.quantity, 0);
  const filtered = useMemo(() => {
    let items = products.filter(p => (category === 'all' || p.category === category) && (p.title.toLowerCase().includes(query.toLowerCase()) || categoryName(p.category).toLowerCase().includes(query.toLowerCase())));
    if (sort === 'cheap') items = [...items].sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === 'expensive') items = [...items].sort((a,b) => (b.price ?? -1) - (a.price ?? -1));
    return items;
  }, [products, category, query, sort]);
  function go(next) { setPrevious(page); setPage(next); setError(''); window.scrollTo(0,0); }
  function back() { setPage(previous === page ? 'home' : previous); window.scrollTo(0,0); }
  function openProduct(p) { setSelected(p.id); setPhoto(0); setSize(''); go('product'); }
  function showCategory(id) { setCategory(id); go('catalog'); }
  function addCart(p, chosenSize = size) {
    if (p.price == null || p.stock === 0) return;
    if (p.sizes.length && !chosenSize) {
      setError('Выберите размер');
      document.querySelector('.size-head')?.scrollIntoView({ block:'center' });
      return;
    }
    const itemSize = chosenSize || 'Без размера';
    setCart(old => {
      const existing = old.find(x => x.id === p.id && x.size === itemSize);
      return existing ? old.map(x => x === existing ? { ...x, quantity: x.quantity + 1 } : x) : [...old, { id:p.id, size:itemSize, quantity:1 }];
    });
    setError('');
    setToast('Добавлено в корзину');
    tg?.HapticFeedback?.notificationOccurred('success');
  }
  function quickAdd(p) {
    if (p.sizes.length) openProduct(p);
    else addCart(p, '');
  }
  function changeCart(id, s, delta) { setCart(old => old.map(x => x.id === id && x.size === s ? { ...x, quantity: x.quantity + delta } : x).filter(x => x.quantity > 0)); }
  function removeCart(id, s) { const key = id + s; setExitingCart(key); window.setTimeout(() => { setCart(old => old.filter(i => !(i.id === id && i.size === s))); setExitingCart(''); }, 170); }
  const shoes = lines.filter(x => x.product.category === 'shoes');
  const hasClothes = shoes.length < lines.length;
  function toggleFavorite(id) { setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]); }
  function submitOrder(e) {
    e.preventDefault(); setError('');
    if (!lines.length) return setError('Корзина пуста');
    if (checkout.fullName.trim().split(/\s+/).length < 2) return setError('Укажите фамилию и имя получателя');
    if (!/^\+?\d[\d\s()-]{7,18}$/.test(checkout.phone.trim()) || checkout.phone.replace(/\D/g,'').length < 9) return setError('Проверьте номер телефона');
    if (!checkout.city.trim() || !checkout.branch.trim()) return setError('Укажите город и адрес отделения Европочты');
    if (hasClothes && ![checkout.height, checkout.weight].every(v => Number.isFinite(Number(v)) && Number(v) >= 1)) return setError('Укажите рост и вес');
    if (shoes.some(x => x.size === 'Без размера' && !checkout.shoeSizes[x.id]?.trim())) return setError('Укажите размер обуви');
    const order = {
      id: createOrderId(), createdAt: new Date().toLocaleString('ru-BY'), status: 'Новый', total,
      items: lines.map(x => ({
        title: cleanTitle(x.product), quantity: x.quantity, price: x.product.price,
        size: x.product.category === 'shoes' && x.size === 'Без размера' ? checkout.shoeSizes[x.id].trim() : x.size,
      })),
      customer: {
        fullName: checkout.fullName.trim(), phone: checkout.phone.trim(),
        city: checkout.city.trim(), branch: checkout.branch.trim(),
        ...(hasClothes ? { height: Number(checkout.height), weight: Number(checkout.weight) } : {}),
      },
      payment: 'Наложенный платёж через Европочту',
    };
    setOrders(old => [order, ...old]); setCart([]); setCompleted(order); go('success'); tg?.HapticFeedback?.notificationOccurred('success');
  }
  async function saveProduct(event) {
    event.preventDefault();
    if (savingProduct.current) return;
    if (!editor.title.trim()) return setError('Добавьте название');
    const isNew = !editor.id;
    const id = editor.id || 'local-' + crypto.randomUUID();
    const product = {
      ...editor, id, slug: editor.slug || id, title: editor.title.trim(),
      price: editor.price === '' ? null : Number(editor.price),
      stock: editor.stock === '' ? null : Number(editor.stock),
      sizes: editor.sizes.split(',').map(value => value.trim()).filter(Boolean),
    };
    if (product.price !== null && (!Number.isFinite(product.price) || product.price < 0)) return setError('Проверьте цену');
    if (isNew) product.channelPost = 'pending';
    const updated = isNew ? [product, ...products] : products.map(p => p.id === id ? product : p);
    try {
      write('products', updated);
    } catch {
      return setError('Не удалось сохранить товар. Уменьшите размер фотографий и попробуйте снова.');
    }
    savingProduct.current = true;
    setProducts(updated);
    go('admin');
    if (isNew) {
      try {
        const status = await publishProduct({ ...product, category: categoryName(product.category) }, tg?.initData);
        setProducts(old => old.map(p => p.id === id ? { ...p, channelPost: status } : p));
      } finally {
        savingProduct.current = false;
      }
    } else {
      savingProduct.current = false;
    }
  }
  const current = products.find(p => p.id === selected);
  const nav = [{ id:'home', label:'Главная', icon:House }, { id:'catalog', label:'Каталог', icon:LayoutGrid }, { id:'cart', label:'Корзина', icon:ShoppingBag }, { id:'profile', label:'Профиль', icon:UserRound }];
  return <div className="app-shell">
    {splash !== 'none' && <div className={`splash splash-${splash}`} onTransitionEnd={e => { if (e.target === e.currentTarget && splash === 'exit') setSplash('none'); }}><div className="splash-glow"/><img src="/croos-opt-logo.png" alt="CROOS_OPT" onAnimationEnd={() => { if (splash === 'intro') setSplash('exit'); }}/></div>}
    <header className="topbar"><button className="icon-button" onClick={page === 'home' ? () => go('catalog') : back} aria-label="Назад">{page === 'home' ? <LayoutGrid/> : <ArrowLeft/>}</button><button className="brand" onClick={() => go('home')} aria-label={`${STORE_NAME} — главная`}><img className="brand-logo" src="/croos-opt-logo.png" alt=""/><span>{STORE_NAME}<span className="brand-dot">.</span></span></button><button className="icon-button" onClick={() => go('cart')} aria-label="Корзина"><ShoppingBag/>{count > 0 && <i key={count} className="badge badge-pop">{count}</i>}</button></header>
    <main key={page} className={`page-enter ${page === 'product' ? 'with-purchase' : ''}`}>
      {page === 'home' && <><section className="hero"><div className="hero-text"><div className="eyebrow"><span className="pulse"/> ТВОЙ СТИЛЬ. ТВОИ ПРАВИЛА.</div><h1>ДВИЖЕНИЕ<br/><em>В ТВОЁМ</em><br/>СТИЛЕ.</h1><p>Одежда, обувь и аксессуары для каждого дня.</p><button className="yellow-button" onClick={() => showCategory('all')}>Смотреть каталог <ArrowRight size={18}/></button></div><span className="hero-index">01 / STYLE EDIT</span></section><section className="section"><div className="section-title"><div><small>ВЫБИРАЙ СВОЁ</small><h2>Категории</h2></div><button className="text-link" onClick={() => showCategory('all')}>Все <ArrowRight size={16}/></button></div><div className="category-scroll">{categories.map(c => { const p = products.find(x => x.category === c.id); return <button className="category-tile" key={c.id} onClick={() => showCategory(c.id)}><div>{p?.images[0] && <img src={displayImage(p)} alt=""/>}</div><strong>{c.label}</strong><span>{products.filter(x => x.category === c.id).length} товаров <ArrowRight size={14}/></span></button>; })}</div></section><section className="section"><div className="section-title"><div><small>ИЗ КАТАЛОГА</small><h2>На виду</h2></div><button className="text-link" onClick={() => showCategory('all')}>Все <ArrowRight size={16}/></button></div><ProductGrid products={products.slice(0,6)} openProduct={openProduct} favorites={favorites} toggleFavorite={toggleFavorite} quickAdd={quickAdd}/></section><div className="promo"><BadgePercent/><div><strong>Найди свой образ</strong><span>Просматривай реальные фото товаров и выбирай размер.</span></div><ArrowRight/></div></>}
      {page === 'catalog' && <section className="section catalog-page"><div className="page-head"><small>КОЛЛЕКЦИЯ / 2026</small><h1>Каталог<span className="accent-dot">.</span></h1><p>Вещи, которые хочется носить.</p></div><label className="search"><Search size={19}/><input placeholder="Поиск по каталогу" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')}><X size={16}/></button>}</label><div className="chips"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Все</button>{categories.map(c => <button key={c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)}>{c.label}</button>)}</div><div className="list-tools"><span>Найдено: {filtered.length}</span><label><Settings2 size={17}/><select value={sort} onChange={e => setSort(e.target.value)}><option value="default">По умолчанию</option><option value="cheap">Сначала дешевле</option><option value="expensive">Сначала дороже</option></select></label></div><ProductGrid key={`${category}-${sort}-${query}`} products={filtered} openProduct={openProduct} favorites={favorites} toggleFavorite={toggleFavorite} quickAdd={quickAdd}/>{filtered.length === 0 && <Empty text="Ничего не найдено"/>}</section>}
      {page === 'product' && current && <><div className="product-gallery" onTouchStart={e => { touchStart.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touchStart.current == null) return; const distance = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 35) setPhoto(i => Math.max(0, Math.min(current.images.length - 1, i + (distance < 0 ? 1 : -1)))); touchStart.current = null; }}><img key={photo} className="gallery-photo" src={current.images[photo] || current.images[0]} alt={cleanTitle(current)}/><button className="gallery-fav" onClick={() => toggleFavorite(current.id)} aria-label="В избранное"><Heart fill={favorites.includes(current.id) ? '#ffce00' : 'none'}/></button>{current.images.length > 1 && <div className="gallery-dots">{current.images.map((_,i) => <button key={i} className={photo === i ? 'active' : ''} onClick={() => setPhoto(i)} aria-label={'Фото ' + (i+1)}/>)}</div>}</div><section className="product-info"><small>{categoryName(current.category)}</small><h1>{cleanTitle(current)}</h1><strong className="price-large">{money(current.price)}</strong><p>{current.description || 'Описание пока не добавлено.'}</p><div className="product-facts"><span><Truck size={17}/> Европочта</span><span className={current.stock > 0 ? 'in-stock' : 'stock-neutral'}>{current.stock == null ? 'Наличие уточняется' : current.stock > 0 ? `В наличии: ${current.stock}` : 'Нет в наличии'}</span></div><div className="size-head"><strong>Размер</strong><span>{current.sizes.length ? 'Выберите размер' : 'Размер уточняется'}</span></div>{current.sizes.length ? <div className="size-grid">{current.sizes.map(s => <button key={s} className={size === s ? 'active' : ''} onClick={() => { setSize(s); setError(''); }}>{s}</button>)}</div> : <p className="muted">Уточните размер у продавца перед заказом.</p>}{error && <p className="feedback" role="alert">{error}</p>}<div className="source-note">Фото и сведения из объявления продавца. Наличие и цена требуют подтверждения.</div></section></>}
      {page === 'cart' && <section className="section cart-page"><div className="page-head"><small>ТВОЙ ВЫБОР</small><h1>Корзина<span className="accent-dot">.</span></h1><p>{count} товаров</p></div>{lines.length ? <><div className="cart-list">{lines.map(x => <div className={`cart-item ${exitingCart === x.id+x.size ? 'leaving' : ''}`} key={x.id+x.size}><img src={displayImage(x.product)} alt="" onClick={() => openProduct(x.product)}/><div className="cart-item-info"><strong onClick={() => openProduct(x.product)}>{cleanTitle(x.product)}</strong><span>Размер: {x.size}</span><b>{money(x.product.price)}</b><div className="quantity"><button onClick={() => changeCart(x.id,x.size,-1)} aria-label="Уменьшить"><Minus size={15}/></button><span key={x.quantity} className="value-pop">{x.quantity}</span><button onClick={() => changeCart(x.id,x.size,1)} aria-label="Увеличить"><Plus size={15}/></button></div></div><button className="remove" onClick={() => removeCart(x.id, x.size)} aria-label="Удалить"><Trash2 size={18}/></button></div>)}</div><div className="summary"><div><span>Товары</span><b>{money(total)}</b></div><div><span>Доставка</span><span>Уточняется при оформлении</span></div><div className="summary-total"><strong>Итого за товары</strong><strong key={total} className="value-pop">{money(total)}</strong></div></div><button className="yellow-button full" onClick={() => go('checkout')}>Оформить заказ <ArrowRight size={20}/></button></> : <Empty text="Корзина пока пуста" action={() => showCategory('all')}/>}</section>}
      {page === 'checkout' && <section className="section form-page checkout-page">
        <div className="page-head"><h1>Оформление<span className="accent-dot">.</span></h1></div>
        {lines.length ? <form onSubmit={submitOrder}>
          <fieldset className="checkout-block">
            <legend><UserRound size={16}/> Данные получателя</legend>
            <Field label="ФИО получателя" value={checkout.fullName} onChange={fullName => setCheckout({ ...checkout, fullName })} autoComplete="name" placeholder="Фамилия Имя Отчество" required/>
            <Field label="Номер телефона" value={checkout.phone} onChange={phone => setCheckout({ ...checkout, phone })} autoComplete="tel" placeholder="+375 29 123-45-67" type="tel" required/>
          </fieldset>
          <fieldset className="checkout-block">
            <legend><MapPin size={16}/> Доставка Европочтой</legend>
            <Field label="Город" value={checkout.city} onChange={city => setCheckout({ ...checkout, city })} placeholder="Например, Минск" required/>
            <Field label="Адрес отделения Европочты" value={checkout.branch} onChange={branch => setCheckout({ ...checkout, branch })} placeholder="Улица, дом, номер отделения" required/>
            <div className="payment-box"><Check size={20}/><div><strong>Наложенный платёж</strong><span>Оплата при получении</span></div></div>
          </fieldset>
          <fieldset className="checkout-block">
            <legend><Ruler size={16}/> Размеры</legend>
            {hasClothes && <div className="measurement-fields">
              <Field label="Рост, см" value={checkout.height} onChange={height => setCheckout({ ...checkout, height })} type="number" min="1" step="any" placeholder="175" required/>
              <Field label="Вес, кг" value={checkout.weight} onChange={weight => setCheckout({ ...checkout, weight })} type="number" min="1" step="any" placeholder="70" required/>
            </div>}
            {shoes.map(x => <div className="checkout-shoe" key={x.id + ':' + x.size}>
              <strong>{cleanTitle(x.product)}</strong>
              {x.size === 'Без размера'
                ? <Field label="Размер обуви" value={checkout.shoeSizes[x.id] || ''} onChange={value => setCheckout({ ...checkout, shoeSizes: { ...checkout.shoeSizes, [x.id]: value } })} placeholder="Например, 42" required/>
                : <span>Размер обуви <b>{x.size}</b></span>}
            </div>)}
          </fieldset>
          <div className="summary-total checkout-total"><span>Сумма товаров</span><b>{money(total)}</b></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="yellow-button full" type="submit">Подтвердить заказ <Check size={20}/></button>
          <p className="field-help center">Демо: заказ сохраняется только на этом устройстве.</p>
        </form> : <Empty text="Корзина пока пуста" action={() => showCategory('all')}/>}
      </section>}
      {page === 'success' && completed && <section className="section success-page"><div className="success-icon"><Check size={38}/></div><small>ЗАКАЗ СОХРАНЁН ЛОКАЛЬНО</small><h1>Спасибо!</h1><p>Номер заказа <b>{completed.id}</b></p><div className="receipt"><strong>Состав заказа</strong>{completed.items.map((x,i) => <div key={i}>{x.title} · {x.size} × {x.quantity}<b>{money(x.price*x.quantity)}</b></div>)}<div className="receipt-total">Сумма товаров <b>{money(completed.total)}</b></div></div><div className="receipt"><strong>Данные получателя</strong><p>{completed.customer.fullName}<br/>{completed.customer.phone}<br/>{completed.customer.city}, {completed.customer.branch}<br/>{completed.customer.height && <>Рост {completed.customer.height} см · Вес {completed.customer.weight} кг<br/></>}{completed.payment}</p></div><p className="field-help">Это демонстрационный заказ. Отправление не создано.</p><button className="yellow-button full" onClick={() => go('home')}>На главную <ArrowRight size={20}/></button></section>}
      {page === 'profile' && <section className="section profile-page"><div className="page-head"><small>ЛИЧНЫЙ КАБИНЕТ</small><h1>Профиль<span className="accent-dot">.</span></h1></div><div className="profile-card"><div className="avatar"><UserRound/></div><div><strong>{tg?.initDataUnsafe?.user?.first_name || 'Гость'}</strong><span>{tg ? 'Telegram Mini App' : 'Локальный просмотр'}</span></div><ChevronRight/></div><button className="profile-row" onClick={() => go('orders')}><Package/> Мои заказы <span>{orders.length + demoOrders.length}</span><ChevronRight/></button><button className="profile-row" onClick={() => go('favorites')}><Heart/> Избранное <span>{favorites.length}</span><ChevronRight/></button><div className="demo-role"><strong>Режим для локального тестирования</strong><p>Переключатель не является защитой доступа.</p><button onClick={() => setRole(role === 'buyer' ? 'seller' : 'buyer')}>{role === 'buyer' ? 'Включить роль продавца' : 'Вернуться к роли покупателя'}</button></div>{role === 'seller' && <button className="yellow-button full" onClick={() => go('admin')}><Crown size={20}/> Открыть админ-панель <ArrowRight size={20}/></button>}</section>}
      {page === 'favorites' && <section className="section"><div className="page-head"><small>СОХРАНЕНО</small><h1>Избранное<span className="accent-dot">.</span></h1></div><ProductGrid products={products.filter(p => favorites.includes(p.id))} openProduct={openProduct} favorites={favorites} toggleFavorite={toggleFavorite} quickAdd={quickAdd}/>{favorites.length === 0 && <Empty text="Здесь пока пусто" action={() => showCategory('all')}/>}</section>}
      {page === 'orders' && <section className="section"><div className="page-head"><small>ИСТОРИЯ</small><h1>Мои заказы<span className="accent-dot">.</span></h1></div>{[...orders,...demoOrders].map(o => <OrderCard key={o.id} order={o}/>)}</section>}
      {page === 'admin' && role === 'seller' && <section className="section admin-page"><div className="page-head"><small>ЛОКАЛЬНЫЙ ДЕМО-РЕЖИМ</small><h1>Панель продавца<span className="accent-dot">.</span></h1><p>Изменения видны только на этом устройстве.</p></div><div className="admin-stats"><div><span>Товары</span><strong>{products.length}</strong></div><div><span>Заказы</span><strong>{orders.length}</strong></div></div><div className="section-title"><h2>Товары</h2><button className="small-yellow" onClick={() => { setEditor({ id:'', title:'', description:'', category:categories[0]?.id || 'other', price:'', sizes:'', stock:'', images:[] }); go('editor'); }}><Plus size={17}/> Добавить</button></div><AdminProducts products={products} category={adminCategory} setCategory={setAdminCategory} query={adminQuery} setQuery={setAdminQuery} onEdit={p => { setEditor({ ...p, price:p.price ?? '', stock:p.stock ?? '', sizes:p.sizes.join(', ') }); go('editor'); }}/><div className="section-title"><h2>Заказы</h2></div>{orders.length ? orders.map(o => <div className="admin-order" key={o.id}><div><strong>{o.id}</strong><span>{o.customer.fullName} · {money(o.total)}</span><span>{o.customer.phone}</span><span>{o.customer.city}, {o.customer.branch}</span>{o.customer.height && <span>Рост {o.customer.height} см · Вес {o.customer.weight} кг</span>}<span>{o.items.map(item => `${item.title} · ${item.size} × ${item.quantity}`).join(' / ')}</span></div><select value={o.status} onChange={e => setOrders(old => old.map(x => x.id === o.id ? { ...x, status:e.target.value } : x))}>{['Новый','В обработке','Отправлен','Доставлен','Отменён'].map(s => <option key={s}>{s}</option>)}</select></div>) : <p className="muted">Новых заказов на этом устройстве нет.</p>}</section>}
      {page === 'editor' && role === 'seller' && editor && <section className="section form-page"><div className="page-head"><small>КАТАЛОГ</small><h1>{editor.id ? 'Редактировать' : 'Новый товар'}<span className="accent-dot">.</span></h1></div><form onSubmit={saveProduct}><Field label="Название" value={editor.title} onChange={v => setEditor({ ...editor,title:v })} required/><label className="field">Категория<select value={editor.category} onChange={e => setEditor({ ...editor,category:e.target.value })}>{categories.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></label><Field label="Цена, BYN" value={editor.price} onChange={v => setEditor({ ...editor,price:v })} type="number" placeholder="Не указана"/><Field label="Размеры через запятую" value={editor.sizes} onChange={v => setEditor({ ...editor,sizes:v })} placeholder="S, M, L"/><Field label="Остаток" value={editor.stock} onChange={v => setEditor({ ...editor,stock:v })} type="number" placeholder="Не указан"/><label className="field">Описание<textarea value={editor.description} onChange={e => setEditor({ ...editor,description:e.target.value })}/></label><label className="upload"><ImagePlus/><span>Добавить фотографии</span><input type="file" accept="image/*" multiple onChange={async e => { const files = [...e.target.files]; const images = await Promise.all(files.map(f => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(f); }))); setEditor(old => ({ ...old, images:[...old.images,...images] })); }}/></label><p className="field-help">Фотографии сохраняются локально в браузере. Большие файлы могут превысить объём хранилища.</p><div className="editor-images">{editor.images.map((src,i) => <div key={i}><img src={src} alt=""/><button type="button" onClick={() => setEditor({ ...editor,images:editor.images.filter((_,j) => j !== i) })}><X size={15}/></button></div>)}</div>{!editor.id && <ChannelPreview product={editor}/>}{error && <p className="form-error">{error}</p>}<button className="yellow-button full" type="submit">Сохранить товар <Check size={20}/></button>{editor.id && <button className="delete-button" type="button" onClick={() => { if (confirm('Удалить товар?')) { setProducts(old => old.filter(p => p.id !== editor.id)); go('admin'); } }}><Trash2 size={17}/> Удалить товар</button>}</form></section>}
    </main>
    {page === 'product' && current && <div className="purchase-bar">
      <button className="yellow-button full" disabled={current.price == null || current.stock === 0} onClick={() => addCart(current)}>
        <span><ShoppingBag size={18}/> В корзину</span><strong>{money(current.price)}</strong>
      </button>
    </div>}
    {toast && <div key={toast + count} className="toast" role="status"><span><Check size={17}/></span>{toast}<button onClick={() => setToast('')} aria-label="Закрыть"><X size={15}/></button></div>}
    <nav className="bottom-nav">{nav.map(n => <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}><n.icon size={21} strokeWidth={page === n.id ? 2.6 : 1.8}/><span>{n.label}</span>{n.id === 'cart' && count > 0 && <i key={count} className="badge-pop">{count}</i>}</button>)}</nav>
  </div>;
}

function ProductPhoto({ product }) {
  const [loaded, setLoaded] = useState(false);
  const src = displayImage(product);
  return src ? <><span className={`image-skeleton ${loaded ? 'loaded' : ''}`} aria-hidden="true"/><img className={loaded ? 'photo-ready' : 'photo-loading'} src={src} alt={cleanTitle(product)} loading="lazy" onLoad={() => setLoaded(true)}/></> : <div className="image-placeholder">НЕТ ФОТО</div>;
}
function ProductGrid({ products, openProduct, favorites, toggleFavorite, quickAdd }) {
  return <div className="product-grid">
    {products.map((p, index) => <article className="product-card" key={p.id} style={{ '--card-order': Math.min(index, 8) }}>
      <div className="product-media">
        <button className="product-image" onClick={() => openProduct(p)}><ProductPhoto key={displayImage(p)} product={p}/></button>
        {p.stock > 0 && <span className="product-stock in-stock">В наличии</span>}
        <button className="fav" onClick={() => toggleFavorite(p.id)} aria-label="В избранное"><Heart size={19} fill={favorites.includes(p.id) ? '#ffce00' : 'none'}/></button>
        {p.price != null && p.stock !== 0 && <button className="quick-add" aria-label={p.sizes.length ? 'Выбрать размер: ' + cleanTitle(p) : 'В корзину: ' + cleanTitle(p)} onClick={() => quickAdd(p)}><Plus size={19}/></button>}
      </div>
      <div className="product-card-body"><small>{categoryName(p.category)}</small><button onClick={() => openProduct(p)}>{cleanTitle(p)}</button><strong>{money(p.price)}</strong></div>
    </article>)}
  </div>;
}
const channelStatus = {
  pending: 'Публикация начата · проверяем статус',
  disabled: 'Канал не подключён · товар сохранён',
  published: 'Опубликовано в Telegram',
  forbidden: 'Откройте Mini App в Telegram с аккаунта, которому разрешено публиковать в канале',
  failed: 'Не опубликовано · проверьте подключение',
  unknown: 'Статус неизвестен · проверьте канал',
};

function ChannelPreview({ product }) {
  return <details className="channel-preview">
    <summary><strong>Пост в Telegram</strong><span>Предпросмотр</span></summary>
    <p>Когда канал подключён, бот автоматически публикует новые товары после сохранения.</p>
    <div className="channel-preview-card">
      {product.images[0] && <img src={product.images[0]} alt="Фото для поста"/>}
      <div className="channel-preview-text">{formatChannelPost({ ...product, category: categoryName(product.category) })}</div>
      <div className="channel-preview-link">Открыть магазин <ArrowRight size={14}/></div>
    </div>
  </details>;
}
function AdminProducts({ products, category, setCategory, query, setQuery, onEdit }) {
  const [limit, setLimit] = useState(20);
  useEffect(() => setLimit(20), [category, query]);
  const groups = categories.map(c => ({ ...c, count: products.filter(p => p.category === c.id).length }));
  const unknown = products.filter(p => !categories.some(c => c.id === p.category)).length;
  if (unknown) groups.push({ id:'uncategorized', label:'Без категории', count:unknown });
  const term = query.trim().toLocaleLowerCase('ru');
  const items = products.filter(p => (category === 'all' || (category === 'uncategorized' ? !categories.some(c => c.id === p.category) : p.category === category)) && (!term || `${p.title} ${p.id}`.toLocaleLowerCase('ru').includes(term)));
  const label = category === 'all' ? 'Все товары' : groups.find(c => c.id === category)?.label || 'Без категории';
  return <div className="admin-products">
    <div className="admin-category-grid" role="group" aria-label="Категории товаров">
      {[{ id:'all', label:'Все товары', count:products.length }, ...groups].map(c => <button key={c.id} aria-pressed={category === c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)}><span>{c.label}</span><b>{c.count}</b></button>)}
    </div>
    <label className="search admin-search"><Search size={18}/><input aria-label="Поиск товаров в админке" placeholder="Название или артикул" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={16}/></button>}</label>
    <div className="admin-results"><strong>{label}</strong><span role="status">Найдено: {items.length}</span></div>
    <div className="admin-list" key={category}>
      {items.slice(0, limit).map(p => <button className="admin-item admin-product-row" key={p.id} onClick={() => onEdit(p)} aria-label={`Редактировать: ${cleanTitle(p)}`}><img src={displayImage(p)} alt=""/><div><small>{categoryName(p.category)}</small><strong>{cleanTitle(p)}</strong><span>{money(p.price)} · {p.stock == null ? 'остаток не указан' : `остаток ${p.stock}`}</span>{p.channelPost && <span className="channel-status" data-status={p.channelPost}>{channelStatus[p.channelPost]}</span>}</div><ChevronRight size={18}/></button>)}
      {!items.length && <div className="admin-empty"><Search size={25}/><strong>{term ? 'Ничего не найдено' : 'В категории пока нет товаров'}</strong><p>{term ? 'Попробуйте другое название или артикул.' : 'Добавьте товар и выберите эту категорию в форме.'}</p>{term && <button className="text-link" onClick={() => setQuery('')}>Сбросить поиск</button>}</div>}
    </div>
    {items.length > limit && <button className="admin-load-more" onClick={() => setLimit(n => n + 20)}>Показать ещё <span>{items.length - limit}</span><Plus size={16}/></button>}
  </div>;
}
function Field({ label, value, onChange, type='text', placeholder='', required=false, ...inputProps }) { return <label className="field">{label}<input {...inputProps} value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder} required={required}/></label>; }
function Empty({ text, action }) { return <div className="empty"><ShoppingBag size={38}/><h2>{text}</h2>{action && <button className="yellow-button" onClick={action}>Смотреть каталог <ArrowRight size={18}/></button>}</div>; }
function OrderCard({ order:o }) { return <div className="order-card"><div><strong>{o.id}</strong><span className="status">{o.status}</span></div><small>{o.createdAt}</small><p>{o.items.map(x => `${x.title} × ${x.quantity}`).join(', ')}</p><b>{money(o.total)}</b></div>; }

createRoot(document.getElementById('root')).render(<App/>);
