import preact from 'preact'

import { CombinedCollection } from '../../models/combinedCollection.js'
import { back } from '../../stores/navigation.js'
import { taskExpandedStore } from '../../stores/taskexpanded.js'

import { NotFound } from '../notfound.jsx'
import Header from './header.jsx'
import Sortable from './sortable.jsx'
import TasksEditor from './editormobile.jsx'
import TasksPopover from './editordesktop.jsx'

const defaultList = 'inbox'

export default class Tasks extends preact.Component {
  constructor(props) {
    super(props)
    this.state = this.installProps(props, true)
    this.state.innerWidth = '100%'
    this.observer = null
  }
  componentWillMount() {
    CombinedCollection.bind('update', this.update)
    CombinedCollection.bind('order', this.update)
  }
  componentDidMount() {
    window.addEventListener('resize', this.windowResize)

    if (this.state.selectedTask !== null) {
      document.body.classList.add('selected-task-bg')
    }
  }
  componentWillUnmount() {
    CombinedCollection.unbind('update', this.update)
    CombinedCollection.unbind('order', this.update)
    window.removeEventListener('resize', this.windowResize)
    this.observer.disconnect()
  }
  componentWillReceiveProps(nextProps) {
    const state = this.installProps(nextProps)
    if (!nextProps.task && this.state.taskDisposing === true) {
      setTimeout(() => {
        this.setState({
          taskDisposing: false
        })
      }, 300)
    }
    if (typeof nextProps.list !== 'undefined' && nextProps.list !== this.state.list && this.state.list !== 'notfound') {
      window.scroll(0,0)
      this.mobileScroll.scrollTop = 0
      taskExpandedStore.create(null, 0)
    }
    if (this.state.selectedTask !== state.selectedTask) {
      if (state.selectedTask === null) { 
        requestAnimationFrame(() => {
          document.body.classList.remove('selected-task-bg')
        })
      } else {
        setTimeout(() => {
          requestAnimationFrame(() => {
            document.body.classList.add('selected-task-bg')
          })
        }, 250)
      }
    }
    this.setState(state)
  }
  componentDidUpdate() {
    this.observe()
  }
  observe() {
    if (this.observer !== null) {
      return
    }
    const el = document.getElementById('tasks-sticky-helper')
    if (el === null) {
      return
    }

    const options = {
      root: null,
      rootMargin: '-12px',
      threshold: 0
    }
    this.observer = new IntersectionObserver(this.triggerStickyScroll, options)    
    this.observer.observe(el)
  }
  installProps(nextProps, firstRun = false) {
    let newProps = {
      selectedTask: null,
    }
    if (nextProps.task) {
      newProps.selectedTask = nextProps.task
      newProps.taskDisposing = true
    }
    if (firstRun) {
      newProps.list = defaultList
      newProps.stickyScale = false
      newProps.taskList = []
    }
    if (document.documentElement.clientWidth >= 700) {
      if (typeof nextProps.list === 'undefined') {
        nextProps.list = defaultList
      }
    } else {
      if (typeof nextProps.list === 'undefined') {
        nextProps.list = null
      }
    }
    if (nextProps.list === this.state.list) {
      CombinedCollection.trigger('list-change', nextProps.list)
      newProps.disposing = false
      return newProps
    }
    if (nextProps.list) {
      const tasks = CombinedCollection.getTasks(nextProps.list)
      if (tasks === null) {
        newProps.list = 'notfound'
        return newProps
      }
      if (this.props.list !== nextProps.list || firstRun) {
        CombinedCollection.trigger('list-change', nextProps.list)
        newProps.taskList = tasks.tasks
      }
      newProps.disposing = false
      newProps.list = nextProps.list
      newProps.order = tasks.order
    } else {
      CombinedCollection.trigger('list-change', null)
      newProps.disposing = true
    }
    return newProps
  }
  // allows desktop to reset to default list when resized
  windowResize = () => {
    // wish css & js variables could cross over sometimes
    if (
      document.documentElement.clientWidth >= 700 &&
      typeof this.props.list === 'undefined'
    ) {
      if (this.state.list !== defaultList) {
        this.setState(this.installProps(this.props, true))
      }
    }
  }
  update = (key, value) => {
    if (key !== 'task' || value === this.state.list) {
      // TODO: This probably needs to be more robust
      // prevents order update when list is expanded?
      // if (this.props.task !== '') {
      //   return
      // }
      const tasks = CombinedCollection.getTasks(this.state.list)
      if (tasks === null) {
        return this.setState({
          list: 'notfound'
        })
      }
      this.setState({
        taskList: tasks.tasks,
        order: tasks.order
      })
    }
  }
  triggerArchive = () => {
    CombinedCollection.archiveCompletedList(this.state.list)
  }
  triggerStickyScroll = entries => {
    if (typeof this.props.list !== 'undefined') {
      this.setState({
        stickyScale: !entries[0].isIntersecting
      })
    }
  }
  closeTasks = e => {
    if (e.target === e.currentTarget || e.target.className === 'tasks-list') {
      if (window.location.pathname.split('/').length === 4) {
        back()
      }
    }
  }
  render() {
    if (this.state.list === 'notfound') {
      return <NotFound />
    }
    const list = CombinedCollection.getList(this.state.list)
    const mutable = list.mutable.indexOf('no-order') === -1
    let className = 'tasks-pane'
    let footerClassName = 'tasks-pane-footer'
    if (this.state.disposing === true) {
      className += ' hide'
    }
    if (this.props.task) {
      className += ' selected-task'
      footerClassName += ' offset-down'
    } else if (this.state.taskDisposing) {
      className += ' selected-task-hide'
    }
    let archiveBtn = null
    const signedin = CombinedCollection.signedin()
    const completedTasks = this.state.taskList.filter(task => {
      if (!signedin || (task.serverId !== null && typeof task.serverId !== 'undefined')) {
        return (task.completed !== null && task.completed !== 'undefined' && task.type !== 'archived')
      }
      return false
    }).length
    if (completedTasks > 0 && mutable) {
      archiveBtn = <button className="button minimal small" onClick={this.triggerArchive}>
        <img src="/img/icons/material/archive.svg" />
        Archive {completedTasks} completed tasks
      </button>
    }
    return (
      <div
        class={className}
        id="passive-scroll-wrapper"
        onClick={this.closeTasks}
      >
        <div class="tasks-content" ref={e => this.mobileScroll = e}>
          <div class="tasks-scrollwrap" onClick={this.closeTasks}>
            <div id="tasks-sticky-helper" class="tasks-sticky-helper" />
            <Header
              stickyScale={this.state.stickyScale}
              list={this.state.list}
              name={list.name}
              mutable={list.mutable.indexOf('no-rename')}
            />
            <Sortable
              mutable={mutable}
              task={this.props.task}
              taskList={this.state.taskList}
              list={this.state.list}
              listOrder={this.state.order}
            />
            <footer className={footerClassName} onClick={this.closeTasks}>
              {archiveBtn}
            </footer>
          </div>
        </div>
        <TasksEditor task={this.props.task || ''} />
        <TasksPopover task={this.props.task || ''} />
      </div>
    )
  }
}
