'use client';
 
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { Row, Col, FormGroup, InputGroup, Container } from 'react-bootstrap';
import { Button, Form, Modal } from 'react-bootstrap';
import ChewNavbar from '../../navbar.js';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from "react";
import { fetchAPI, fetchFormDataAPI } from '../../util.js';
import { useSnackbar } from 'react-simple-snackbar';

// Represents a single menu item, inside of a menu category
function MenuItem({ itemid, restaurantData, reloadRestaurantData, data, userStatus, textEdit, removeItemById }) {
  const [active, setActive] = useState(data.active);
  const [name, setName] = useState(data.name);
  const [desc, setDesc] = useState(data.desc);
  const [openSnackbar, closeSnackbar] = useSnackbar();
  const itemId = data.id;

  async function updateActiveStatus(active) {
    const data = await fetchAPI(`/restaurant/${restaurantData.id}/item/${itemId}`, 'PUT', JSON.stringify({ active }));
    if (data === undefined || !data.success) {
      openSnackbar('ERROR: Failed to update active status');
      return;
    }
    setActive(active);
    openSnackbar(active ? `Activated "${name}"` : `Deactivated "${name}"`);
  }

  function editName() {
    textEdit('Edit item name', name, async (newValue) => {
      const data = await fetchAPI(`/restaurant/${restaurantData.id}/item/${itemId}`, 'PUT', JSON.stringify({ name: newValue }));
      if (data === undefined || !data.success) {
        openSnackbar('ERROR: Failed to update name');
        return;
      }
      openSnackbar(`Renamed "${name}" to "${newValue}"`);
      setName(newValue);
    });
  }

  function editDesc() {
    textEdit('Edit item description', desc, async (newValue) => {
      const data = await fetchAPI(`/restaurant/${restaurantData.id}/item/${itemId}`, 'PUT', JSON.stringify({ desc: newValue }));
      if (data === undefined || !data.success) {
        openSnackbar('ERROR: Failed to update name');
        return;
      }
      openSnackbar(`Updated item description for "${name}"`);
      setDesc(newValue);
    });
  }

  function deleteItem() {
    textEdit('Really delete item? Type "yes"', 'no', async (newValue) => {
      if (newValue !== 'yes')
        openSnackbar(`Didn't delete anything.`);
        return;

      if (await removeItemById(itemId)) {
        openSnackbar(`Removed item "${name}"`);
        await reloadRestaurantData();
      } else {
        openSnackbar('ERROR: Failed to remove item');
      }
    });
  }

  let i = 0;
  return (
    <Row key={itemid} id={`item-id-${itemid}`} className={"align-items-start text-center " + (active ? styles.entry : styles.entry_inactive)}>
      <Col>
        <h2>
          {name}
          {
            userStatus === 'owner' ?
              <>{' '}<a href="#" className={styles.text_edit} onClick={() => editName()}>(Edit)</a></>
            :
              <></>
          }
        </h2>
      </Col>
      <Col className={styles.col_mid}>
        {
          // List all of the variants of this item
          data.variants.map(variant => {
            let currIndex = i++;
            return (
              <h3 key={currIndex} 
                  className={styles.variant_main}>
                {variant.name} - {variant.price_usd}
              </h3>
            );
          })
          // TODO: actual variant adding functionality here
        }
      </Col>
      <Col>
        <h3><a href={`#item-id-${itemid}`} className={styles.text_activation} onClick={() => updateActiveStatus(!active)}>{active ? '(Deactivate)' : '(Activate)'}</a></h3>
        {
          userStatus === 'owner' ?
            <h3><a href={`#item-id-${itemid}`} className={styles.text_activation} onClick={() => deleteItem()}>(Delete)</a></h3>
          :
            <></>
        }
      </Col>
      <h4 className={styles.entry_desc}>
        {desc}
        {
          userStatus === 'owner' ?
            <>{' '}<a href="#" className={styles.text_edit} onClick={() => editDesc()}>(Edit)</a></>
          :
            <></>
        }
      </h4>
    </Row>
  );
}

// Represents a single category of item in a restaurant
function MenuCategory({ catid, reloadRestaurantData, restaurantData, data, userStatus, textEdit }) {
  const [name, setName] = useState(data.name);
  const [active, setActive] = useState(data.active);
  const [addNewItemView, setAddNewItemView] = useState(false);
  const [addNewItemName, setAddNewItemName] = useState('');
  const [addNewItemDesc, setAddNewItemDesc] = useState('');
  const [addNewItemActive, setAddNewItemActive] = useState(true);
  const [addNewItemVariants, setAddNewItemVariants] = useState([]);
  const [openSnackbar, closeSnackbar] = useSnackbar();

  async function removeItemById(idToRemove) {
    let ids = [];
    for (const item of data.items) {
      if (item.id === idToRemove) {
        continue;
      }
      ids.push(item.id);
    }
    const resultData = await fetchAPI(`/restaurant/${restaurantData.id}/category/${catid}`, 'PUT', JSON.stringify({ 
      name,
      active: active ? 'true' : 'false',
      move_up: 'false',
      move_down: 'false',
      items: JSON.stringify(ids)
    }));
    if (resultData === undefined || !resultData.success)
      return false;
    return true;
  }

  let entries = [];
  let i = 0;
  for (const entry of data.items) {
    entries.push(<MenuItem key={i++} itemid={entry.id} restaurantData={restaurantData} reloadRestaurantData={reloadRestaurantData} 
                           data={entry} userStatus={userStatus} textEdit={textEdit} removeItemById={removeItemById}/>)
  }

  function getItemIdsFromCategory() {
    let ids = [];
    for (const item of data.items)
      ids.push(item.id);
    return JSON.stringify(ids);
  }

  function editName() {
    textEdit('Edit category name', name, async (newValue) => {
      const data = await fetchAPI(`/restaurant/${restaurantData.id}/category/${catid}`, 'PUT', JSON.stringify({ 
        name: newValue,
        active: active ? 'true' : 'false',
        move_up: 'false',
        move_down: 'false',
        items: getItemIdsFromCategory()
      }));
      if (data === undefined || !data.success) {
        openSnackbar('ERROR: Failed to update name');
        return;
      }
      openSnackbar(`Updated category name from "${name}" to "${newValue}"`);
      setName(newValue);
    });
  }

  async function moveUp() {
    const data = await fetchAPI(`/restaurant/${restaurantData.id}/category/${catid}`, 'PUT', JSON.stringify({ 
      name,
      active: active ? 'true' : 'false',
      move_up: 'true',
      move_down: 'false',
      items: getItemIdsFromCategory()
    }));
    if (data === undefined || !data.success) {
      openSnackbar('ERROR: Failed to move up');
      return;
    }
    await reloadRestaurantData();
  }
  async function moveDown() {
    const data = await fetchAPI(`/restaurant/${restaurantData.id}/category/${catid}`, 'PUT', JSON.stringify({ 
      name,
      active: active ? 'true' : 'false',
      move_up: 'false',
      move_down: 'true',
      items: getItemIdsFromCategory()
    }));
    if (data === undefined || !data.success) {
      openSnackbar('ERROR: Failed to move down');
      return;
    }
    await reloadRestaurantData();
  }
  async function updateActive(active) {
    const data = await fetchAPI(`/restaurant/${restaurantData.id}/category/${catid}`, 'PUT', JSON.stringify({ 
      name,
      active: active ? 'true' : 'false',
      move_up: 'false',
      move_down: 'false',
      items: getItemIdsFromCategory()
    }));
    if (data === undefined || !data.success) {
      openSnackbar('ERROR: Failed to change active state');
      return;
    }
    setActive(active);
  }

  function deleteCategory() {
    textEdit('Really delete category? Type "yes"', 'no', async (newValue) => {
      if (newValue !== 'yes') {
        openSnackbar(`Didn't delete anything.`);
        return;
      }

      const data = await fetchAPI(`/restaurant/${restaurantData.id}/category/${catid}`, 'DELETE');
      if (data === undefined || !data.success) {
        openSnackbar('ERROR: Failed to delete category');
        return;
      }
      openSnackbar(`Deleted category "${name}"`);
      await reloadRestaurantData();
    });
  }

  function addNewItem() {
    setAddNewItemName('');
    setAddNewItemActive(true);
    setAddNewItemVariants([
      {
        name: 'Regular',
        price: '$1.00'
      }
    ])
    setAddNewItemView(true);
  }
  function incVariants() {
    if (addNewItemVariants.length < 8) {
      const newArray = addNewItemVariants.map(i => ({...i}));
      newArray.push({
        name: '',
        price: '$1.00'
      });
      console.log(newArray)
      setAddNewItemVariants(newArray);
    }
  }
  function decVariants() {
    if (addNewItemVariants.length > 1) {
      const newArray = addNewItemVariants.map(i => ({...i}));
      newArray.pop();
      setAddNewItemVariants(newArray);
    }
  }
  function updateVariantName(index, name) {
    const newArray = addNewItemVariants.map(i => ({...i}));
    newArray[index].name = name;
    setAddNewItemVariants(newArray);
  }
  function updateVariantPrice(index, price) {
    const newArray = addNewItemVariants.map(i => ({...i}));
    newArray[index].price = price;
    setAddNewItemVariants(newArray);
  }

  return (
    <div key={catid} className={active ? '' : styles.category_inactive}>
      <h3 className={styles.category_title}>
        {name}
        {
          userStatus === 'owner' ?
            <>
              {' '}<a href="#" className={styles.text_edit} onClick={() => editName()}>(Edit)</a>
              {' '}<a href="#" className={styles.text_edit} onClick={() => moveUp()}>(Move Up)</a>
              {' '}<a href="#" className={styles.text_edit} onClick={() => moveDown()}>(Move Down)</a>
              {' '}<a href="#" className={styles.text_activation} onClick={() => updateActive(!active)}>{active ? '(Deactivate)' : '(Activate)'}</a>
              {' '}<a href="#" className={styles.text_activation} onClick={() => deleteCategory()}>{'(Delete)'}</a>
            </>
          :
            <>
              {' '}<a href="#" className={styles.text_activation} onClick={() => updateActive(!active)}>{active ? '(Deactivate)' : '(Activate)'}</a>
            </>
        }
      </h3>
      {entries}
      {
        userStatus === 'owner' ?
          <>
            <a href="#" className={styles.text_edit} style={{ textAlign: 'center', display: 'block' }} onClick={() => addNewItem()}>(Add new item)</a>
            <Modal data-bs-theme="dark" backdrop="static" show={addNewItemView} onHide={() => setAddNewItemView(false)}>
              <Modal.Header closeButton>
                <Modal.Title>Add new item</Modal.Title>
              </Modal.Header>

              <Modal.Body>
                <form onSubmit={e => e.preventDefault()}>
                  <Form.Label className={styles.add_item_label} htmlFor={`new-item-name-cat-${catid}`}>Name:</Form.Label>
                  <input id={`new-item-name-cat-${catid}`} style={{ width: '100%' }} type="text" value={addNewItemName} onInput={e => setAddNewItemName(e.target.value)} />
                  <Form.Label className={styles.add_item_label} htmlFor={`new-item-desc-cat-${catid}`}>Description:</Form.Label>
                  <input id={`new-item-desc-cat-${catid}`} style={{ width: '100%' }} type="text" value={addNewItemDesc} onInput={e => setAddNewItemDesc(e.target.value)} />
                  <Form.Label className={styles.add_item_label} htmlFor={`new-item-active-cat-${catid}`}>Active:</Form.Label>
                  <input type="checkbox" id={`new-item-active-cat-${catid}`} defaultChecked={addNewItemActive} onChange={() => setAddNewItemActive(!addNewItemActive)} />
                  <Form.Label className={styles.add_item_label} style={{ display: 'block', marginTop: 0 }} htmlFor={`new-item-variant-cat-${catid}`}>Variants:</Form.Label>
                  <Button className={styles.add_item_variant_change} variant="secondary" id={`new-item-variant-cat-${catid}`} onClick={() => incVariants()}>+</Button>
                  <Button className={styles.add_item_variant_change} variant="secondary" id={`new-item-variant-cat-${catid}-2`} onClick={() => decVariants()}>-</Button>
                  {
                    addNewItemVariants.map((variant, index) => {
                      return (
                        <FormGroup key={index} style={index > 0 ? { paddingLeft: '20px', marginTop: '16px' } : { paddingLeft: '20px' }}>
                          <Form.Label className={styles.add_item_label} htmlFor={`new-item-variant-cat-${catid}-ind-${index}-name`}>Variant name:</Form.Label>
                          <input style={{ width: '100%' }} id={`new-item-variant-cat-${catid}-ind-${index}-name`}
                                 value={variant.name} onInput={e => updateVariantName(index, e.target.value)}/>
                          <Form.Label className={styles.add_item_label} htmlFor={`new-item-variant-cat-${catid}-ind-${index}-price`}>Price (USD):</Form.Label>
                          <input style={{ width: '100%' }} id={`new-item-variant-cat-${catid}-ind-${index}-price`}
                                 value={variant.price} onInput={e => updateVariantPrice(index, e.target.value)}/>
                        </FormGroup>
                      );
                    })
                  }
                </form>
              </Modal.Body>

              <Modal.Footer>
                <Button variant="secondary" onClick={() => setAddNewItemView(false)}>Close</Button>
                <Button variant="primary" onClick={async () => {
                  const resultData = await fetchAPI(`/restaurant/${restaurantData.id}/item`, 'POST', JSON.stringify({
                    name: addNewItemName,
                    desc: addNewItemDesc,
                    active: addNewItemActive ? 'true' : 'false',
                    category_index: catid.toString(),
                    variants: JSON.stringify(addNewItemVariants.map(v => { return { name: v.name, price_usd: v.price }}))
                  }));
                  if (resultData === undefined || !resultData.success) {
                    openSnackbar('Failed to add item!');
                    return;
                  }
                  openSnackbar(`Added new item "${addNewItemName}"`);
                  setAddNewItemView(false);
                  await reloadRestaurantData();
                }}>
                  Add Item
                </Button>
              </Modal.Footer>
            </Modal>
          </>
        :
          <></>
      }
    </div>
  );
}

function useTextEditModal() {
  const [textEditView, setTextEditView] = useState(false);
  const [textEditCallback, setTextEditCallback] = useState({ callback: undefined });
  const [textEditTitle, setTextEditTitle] = useState('');
  const [textEditText, setTextEditText] = useState('');

  return {
    textEditView, setTextEditView,
    textEditCallback, setTextEditCallback,
    textEditTitle, setTextEditTitle,
    textEditText, setTextEditText,
    textEdit: (title, initialValue, callback) => {
      setTextEditTitle(title);
      setTextEditText(initialValue);
      setTextEditCallback({ callback });
      setTextEditView(true);
    }
  };
}

function ActualPage() {
  const [data, setData] = useState(undefined);
  const [userStatus, setUserStatus] = useState(undefined);
  const [loaded, setLoaded] = useState(false);
  const {
    textEditView, setTextEditView,
    textEditCallback, setTextEditCallback,
    textEditTitle, setTextEditTitle,
    textEditText, setTextEditText,
    textEdit
  } = useTextEditModal();
  const [updateId, setUpdateId] = useState(0);
  const [openSnackbar, closeSnackbar] = useSnackbar();

  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('id');
  if (restaurantId === undefined)
    return notFound();
  if (restaurantId.includes('.'))
    return notFound();
  if (restaurantId.includes('/'))
    return notFound();

  async function reloadRestaurantData() {
    const data = await fetchAPI(`/restaurant/${restaurantId}`);
    if (data === undefined)
      return;
    setData(data);
    setUpdateId(updateId + 1);
    console.log(updateId);
  }

  useEffect(async () => {
    const data = await fetchAPI(`/restaurant/${restaurantId}`);
    if (data === undefined)
      return;
    setData(data);
    if (!data.success) {
      setLoaded(true);
      return;
    }

    const userStatus = await fetchAPI(`/session/restaurant?id=${restaurantId}`);
    if (userStatus === undefined || !userStatus.success) {
      alert('Failed to load user status.');
      return;
    }
    setUserStatus(userStatus.status);

    setLoaded(true);
  }, []);

  if (!loaded)
    return <Container><Row><p style={{ marginTop: '64px' }}>Loading...</p></Row></Container>;
  if (!data.success)
    return notFound();
  if (userStatus === 'user') {
    window.location.replace('/home/');
    return <></>;
  }

  let categories = [];
  let i = 0;
  for (const category of data.categories) {
    categories.push(<MenuCategory key={updateId + '-' + i} catid={i++} restaurantData={data} reloadRestaurantData={reloadRestaurantData} 
                                  data={category} userStatus={userStatus} textEdit={textEdit}/>);
  }

  function editName() {
    textEdit('Edit restaurant name', data.name, async (newValue) => {
      const resultData = await fetchAPI(`/restaurant/${data.id}`, 'PUT', JSON.stringify({ 
        name: newValue
      }));
      if (resultData === undefined || !resultData.success) {
        openSnackbar('ERROR: Failed to update name');
        return;
      }
      openSnackbar(`Updated restaurant name from "${data.name}" to "${newValue}"`);
      await reloadRestaurantData();
    });
  }

  function editImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => { 
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('image', file);
      const uploadData = await fetchFormDataAPI(`/restaurant/${restaurantId}`, 'PUT', formData);
      if (uploadData === undefined || !uploadData.success) {
        openSnackbar('Failed to update image.');
        return;
      }
      openSnackbar('Updated image successfully.');
    };
    input.click();
  }

  function addNewCategory() {
    textEdit('Enter new category name', '', async (newValue) => {
      const resultData = await fetchAPI(`/restaurant/${data.id}/category`, 'POST', JSON.stringify({ 
        name: newValue,
        active: 'true'
      }));
      if (resultData === undefined || !resultData.success) {
        openSnackbar('ERROR: Failed to add category');
        return;
      }
      openSnackbar(`Added new category "${newValue}"`);
      await reloadRestaurantData();
    });
  }

  return (
    <>
      <h1 className={styles.title}>
        <span className="centerTitle">
          Edit "{data.name}"
          { 
            userStatus === 'owner' ? 
              <>
                {' '}<a href="#" className={styles.text_edit} onClick={() => editName()}>(Edit name)</a>
                {' '}<a href="#" className={styles.text_edit} onClick={() => editImage()}>(Edit image)</a>
              </>
            :
              <></>
          }
        </span>
      </h1>
      {categories}
      {
        userStatus === 'owner' ?
          <>
            <a href="#" className={styles.text_edit} style={{ textAlign: 'center', display: 'block' }} onClick={() => addNewCategory()}>(Add new category)</a>
          </>
        :
          <></>
      }
      <br/>
      <div className={styles.admin}>
        <a href={`/menus/?id=${restaurantId}`} className={styles.text_edit_footer}>(View live page)</a>
      </div>
      <br/>
      <br/>
      <Modal data-bs-theme="dark" backdrop="static" show={textEditView} onHide={() => setTextEditView(false)}>
        <Modal.Header closeButton>
          <Modal.Title style={{}}>{textEditTitle}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <form onSubmit={e => e.preventDefault()}>
            <p>Input text:</p>
            <input id="text-edit-input" style={{ width: "100%" }} type="text" value={textEditText} onInput={e => setTextEditText(e.target.value)} />
          </form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setTextEditView(false)}>Close</Button>
          <Button variant="primary" onClick={() => {
            textEditCallback.callback(textEditText);
            setTextEditView(false);
          }}>Update</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default function Page() {
  return (
    <main className="content p-3 mx-auto">
      <ChewNavbar/>
      <Suspense>
        <ActualPage/>
      </Suspense>
    </main>
  );
}
